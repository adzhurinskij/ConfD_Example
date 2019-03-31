/*********************************************************************
 * ConfD Config intro example, JAVA version
 * See Chapter 7. The external database API
 *
 * (C) 2016 Tail-f Systems
 * Permission to use this code as a starting point hereby granted
 *
 * See the README file for more information
 ********************************************************************/

import com.tailf.conf.*;
import com.tailf.dp.*;
import com.tailf.dp.annotations.DBCallback;
import com.tailf.dp.annotations.DataCallback;
import com.tailf.dp.annotations.TransCallback;
import com.tailf.dp.proto.DBCBType;
import com.tailf.dp.proto.DataCBType;
import com.tailf.dp.proto.TransCBType;
import org.apache.log4j.Logger;

import java.io.File;
import java.net.Socket;
import java.util.Iterator;
import java.util.concurrent.SynchronousQueue;
import java.util.concurrent.TimeUnit;

public final class Hosts {

    private static final Logger log = Logger.getRootLogger();
    private static final int MAX_SESSIONS = 10;
    private static final String CONFD_HOST = "127.0.0.1";
    private static int daemonRetVal = Conf.REPLY_OK;

    /**
     * @see DpTransCallback
     */
    public final static class CbTrans {
        @TransCallback(callType = TransCBType.INIT)
        public void init(DpTrans trans) throws DpCallbackException {
            log.info("==> init trans.getDBName()=" + trans.getDBName());
            log.info("<== init");
        }

        @TransCallback(callType = TransCBType.TRANS_LOCK)
        public void transLock(DpTrans trans) throws DpCallbackException {
            log.info("==> transLock trans.getDBName()=" + trans.getDBName());
            // here we should lock external DB for writing, but still enable
            // ConfD to have read access (to gather old values)
            // This is omitted to simplify example.
            log.info("<== transLock");
        }

        @TransCallback(callType = TransCBType.TRANS_UNLOCK)
        public void transUnlock(DpTrans trans) throws DpCallbackException {
            log.info("==> transUnlock trans.getDBName()=" + trans.getDBName());
            // we should check if external DB was locked for transaction (by id)
            // in transLock and unlock it in such case
            // This is omitted to simplify example.
            log.info("<== transUnlock");
        }

        @TransCallback(callType = TransCBType.WRITE_START)
        public void writeStart(DpTrans trans) throws DpCallbackException {
            log.info("==> writeStart trans.getDBName()=" + trans.getDBName());
            // here we should lock external DB for reading and writing
            // in this example we are processing only CBs to RUNNING db
            // and let candidate handle to ConfD
            if (trans.getDBName() == Conf.DB_RUNNING) {
                HostDb.getInstance().getLock().lock();
            }
            log.info("<== writeStart");
        }

        @TransCallback(callType = TransCBType.PREPARE)
        public void prepare(DpTrans trans) throws DpCallbackException {
            log.info("==> prepare trans.getDBName()=" + trans.getDBName());
            log.info("<== prepare");
        }

        @TransCallback(callType = TransCBType.ABORT)
        public void abort(DpTrans trans) throws DpCallbackException {
            log.info("==> abort trans.getDBName()=" + trans.getDBName());
            log.info("<== abort");
        }

        @TransCallback(callType = TransCBType.COMMIT)
        public void commit(DpTrans trans) throws DpCallbackException {
            log.info("==> commit trans.getDBName()=" + trans.getDBName());
            // in this example we are processing only CBs to RUNNING db
            // and let candidate handle to ConfD
            if (trans.getDBName() == Conf.DB_RUNNING) {
                Iterator<DpAccumulate> accumulated = trans.accumulated();
                while (accumulated.hasNext()) {
                    DpAccumulate item = accumulated.next();
                    if (item.getCallPoint().toString().equals(hst
                            .callpoint_hcp)) {

                        handleTransHcp(item);
                    } else if (item.getCallPoint().toString().equals(hst
                            .callpoint_icp)) {
                        handleTransIcp(item);
                    }
                }
            }
            log.info("<== commit");
        }

        @TransCallback(callType = TransCBType.FINISH)
        public void finish(DpTrans trans) throws DpCallbackException {
            log.info("==> finish trans.getDBName()=" + trans.getDBName());
            // we should check if external DB was locked for transaction (by id)
            // in writesStart.
            // This is omitted to simplify example, we just always unlock if
            // locked
            // in this example we are processing only CBs to RUNNING db
            // and let candidate handle to ConfD
            if (trans.getDBName() == Conf.DB_RUNNING) {
                if (HostDb.getInstance().getLock().isLocked()) {
                    log.trace("unlocking");
                    HostDb.getInstance().getLock().unlock();
                }
            }
            log.info("<== finish");
        }

        private void handleTransHcp(DpAccumulate item) throws
                DpCallbackException {
            log.info("==> handleTransHcp");
            ConfObject[] kp = item.getKP();
            String hostName;
            switch (item.getOperation()) {
                case DpAccumulate.SET_ELEM:
                     /* we're setting the elem of an already existing */
                     /* host entry */
                     /* keypath example: /hosts/host{hname}/defgw */
                    hostName = ((ConfKey) kp[1]).elementAt(0).toString();
                    log.trace("SET_ELEM hostName=" + hostName);
                    HostDb.Host host = HostDb.getInstance().findHost
                            (hostName);
                    switch (((ConfTag) kp[0]).getTagHash()) {
                        case hst.hst_domain:
                            host.domain = item.getValue().toString();
                            break;
                        case hst.hst_defgw:
                            host.defGw = item.getValue().toString();
                            break;
                        default:
                            break;
                    }
                    break;
                case DpAccumulate.CREATE:
                    /* we're creating a brand new host entry */
                    /* it will soon be populated with values */
                    /* keypath example: /hosts/host{hname}   */
                    hostName = ((ConfKey) kp[0]).elementAt(0).toString();
                    log.trace("CREATE hostName=" + hostName);
                    HostDb.getInstance().addHost(hostName, null, null);
                    break;
                case DpAccumulate.REMOVE:
                    hostName = ((ConfKey) kp[0]).elementAt(0).toString();
                    log.trace("REMOVE hostName=" + hostName);
                    host = HostDb.getInstance().findHost
                            (hostName);
                    if (host != null) {
                        HostDb.getInstance().deleteHost(hostName);
                    } else {
                        DpCallbackException e = new DpCallbackException(
                                "Host " + hostName + " was  not found!");
                        log.error(e);
                        throw e;
                    }
                    break;
            }
            log.info("<== handleTransHcp");
        }

        private void handleTransIcp(DpAccumulate item) throws
                DpCallbackException {
            log.info("==> handleTransIcp");
            ConfObject[] kp = item.getKP();
            HostDb.Host host;
            HostDb.Interface iface;
            String hostName, ifaceName;
            switch (item.getOperation()) {
                case DpAccumulate.SET_ELEM:
                    /* we're setting an item in an already existing interface*/
                    /* keypath ex:  */
                    /* /hosts/host{hname}/interfaces/interface{eth0}/ip */
                    hostName = ((ConfKey) kp[4]).elementAt(0).toString();
                    log.trace("SET_ELEM hostName=" + hostName);
                    host = HostDb.getInstance().findHost(hostName);
                    ifaceName = ((ConfKey) kp[1]).elementAt(0).toString();
                    log.trace("ifaceName=" + ifaceName);
                    iface = HostDb.getInstance().findIface(host, ifaceName);
                    if (iface == null) {
                        DpCallbackException e = new DpCallbackException(
                                "For hostName " + hostName + " the interface " +
                                        "" + ifaceName + " was  not found!");
                        log.error(e);
                        throw e;
                    }
                    switch (((ConfTag) kp[0]).getTagHash()) {
                        case hst.hst_ip:
                            iface.ip = item.getValue().toString();
                            break;
                        case hst.hst_mask:
                            iface.mask = item.getValue().toString();
                            break;
                        case hst.hst_enabled:
                            iface.enabled = ((ConfBool) (item.getValue()))
                                    .booleanValue();
                            break;
                        default:
                            break;
                    }
                    break;
                case DpAccumulate.CREATE:
                    /* we're creating a brand new new interface */
                    /* keypath example is */
                    /* /hosts/host{hname}/interfaces/interface{eth0} */
                    hostName = ((ConfKey) kp[3]).elementAt(0).toString();
                    log.trace("CREATE hostName=" + hostName);
                    host = HostDb.getInstance().findHost(hostName);
                    ifaceName = ((ConfKey) kp[0]).elementAt(0).toString();
                    log.trace("ifaceName=" + ifaceName);
                    iface = HostDb.getInstance().new Interface(ifaceName,
                            null, null, false);
                    host.interfaces.add(iface);
                    break;
                case DpAccumulate.REMOVE:
                     /* we're deleting an interface */
                     /* keypath example */
                    /* /hosts/host{hname}/interfaces/interface{eth0} */
                    hostName = ((ConfKey) kp[3]).elementAt(0).toString();
                    log.trace("REMOVE hostName=" + hostName);
                    host = HostDb.getInstance().findHost(hostName);
                    ifaceName = ((ConfKey) kp[0]).elementAt(0).toString();
                    log.trace("ifaceName=" + ifaceName);
                    HostDb.getInstance().deleteIface(host, ifaceName);
                    break;
            }
            log.info("<== handleTransIcp");
        }
    }

    /**
     * @see DpDbCallback
     */
    public final static class CbDb {
        @DBCallback(callType = DBCBType.LOCK)
        public void lock(DpDbContext dbx, int db) throws DpCallbackException {
            log.info("==> lock db=" + db);
            log.info("<== lock");
        }

        @DBCallback(callType = DBCBType.UNLOCK)
        public void unlock(DpDbContext dbx, int db) throws DpCallbackException {
            log.info("==> unlock db=" + db);
            log.info("<== unlock");
        }

        @DBCallback(callType = DBCBType.DELETE_CONFIG)
        public void deleteConfig(DpDbContext dbx, int db) throws
                DpCallbackException {
            log.info("==> deleteConfig db=" + db);
            DpCallbackException e = new DpCallbackException("Error from Java!");
            log.error(e);
            throw e;
            //log.info("<== deleteConfig");
        }

        @DBCallback(callType = DBCBType.ADD_CHECKPOINT_RUNNING)
        public void addCheckpointRunning(DpDbContext dbx) throws
                DpCallbackException {
            log.info("==> addCheckpointRunning");
            HostDb.getInstance().dumpDbSync("RUNNING.ckp");
            log.info("<== addCheckpointRunning");
        }


        @DBCallback(callType = DBCBType.DEL_CHECKPOINT_RUNNING)
        public void delCheckpointRunning(DpDbContext dbx) throws
                DpCallbackException {
            log.info("==> delCheckpointRunning");
            if (!new File("RUNNING.ckp").delete()) {
                DpCallbackException e = new DpCallbackException("Error from " +
                        "Java, checkpoint not deleted!");
                log.error(e);
                throw e;
            }
            log.info("<== delCheckpointRunning");
        }

        @DBCallback(callType = DBCBType.ACTIVATE_CHECKPOINT_RUNNING)
        public void activateCheckpointRunning(DpDbContext dbx)
                throws DpCallbackException {
            log.info("==> activateCheckpointRunning");
            HostDb.getInstance().loadDbSync("RUNNING.ckp");
            log.info("<== activateCheckpointRunning");
        }
    }

    /**
     * @see DpDataCallback
     */
    public final static class CbHostData {
        @DataCallback(callPoint = hst.callpoint_hcp, callType = DataCBType
                .GET_ELEM)
        public ConfValue getElem(final DpTrans trans, final ConfObject[]
                kp)
                throws DpCallbackException {
            log.info("==> getElem kp=" + new ConfPath(kp));
            ConfValue retVal = null;
            String hostName = ((ConfKey) kp[1]).elementAt(0).toString();
            log.trace("hostName=" + hostName);
            HostDb.Host host = HostDb.getInstance().findHost(hostName);
            if (host != null) {
                switch (((ConfTag) kp[0]).getTagHash()) {
                    case hst.hst_name:
                        retVal = new ConfBuf(host.name);
                        break;
                    case hst.hst_domain:
                        retVal = new ConfBuf(host.domain);
                        break;
                    case hst.hst_defgw:
                        try {
                            retVal = new ConfIPv4(host.defGw);
                        } catch (ConfException e) {
                            DpCallbackException ex = new DpCallbackException(e);
                            log.error(ex);
                            throw ex;
                        }
                        break;
                    default:
                        DpCallbackException ex = new DpCallbackException
                                ("HERE " + ((ConfTag) kp[0]).getTagHash());
                        log.error(ex);
                        throw ex;
                }
            }
            log.info("<== getElem retVal=" + (retVal == null ? null : retVal));
            return retVal;
        }

        @DataCallback(callPoint = hst.callpoint_hcp, callType = DataCBType
                .ITERATOR)
        public Iterator<Object> iterator(final DpTrans trans,
                                         final ConfObject[] kp) throws
                DpCallbackException {
            log.info("==> iterator kp=" + new ConfPath(kp));
            final Iterator<Object> retVal = HostDb.getInstance()
                    .getHostIterator();
            log.info("<== iterator retVal=" + retVal);
            return retVal;
        }

        @DataCallback(callPoint = hst.callpoint_hcp, callType = DataCBType
                .GET_NEXT)
        public ConfKey getIteratorKey(final DpTrans trans,
                                      final ConfObject[] kp,
                                      final Object obj) throws
                DpCallbackException {
            log.info("==> getIteratorKey kp=" + new ConfPath(kp) +
                    " obj=" + obj.toString());
            final ConfObject val = new ConfBuf(((HostDb.Host) obj).name);
            log.info("<== getIteratorKey val=" + val.toString());
            return new ConfKey(val);
        }

        @DataCallback(callPoint = hst.callpoint_hcp, callType = DataCBType
                .NUM_INSTANCES)
        public int numInstances(DpTrans trans, ConfObject[] kp)
                throws DpCallbackException {
            log.info("==> numInstances kp=" + new ConfPath(kp));
            int retVal = HostDb.getInstance().numInstances();
            log.info("<== numInstances retVal=" + retVal);
            return retVal;
        }

        @DataCallback(callPoint = hst.callpoint_hcp,
                callType = DataCBType.SET_ELEM)
        public int setElem(DpTrans trans, ConfObject[] kp, ConfValue val)
                throws DpCallbackException {
            log.info("==> setElem kp=" + new ConfPath(kp) +
                    " val=" + val.toString());
            int retVal = Conf.REPLY_ACCUMULATE;
            log.info("<== setElem retVal=" + retVal);
            return retVal;
        }

        @DataCallback(callPoint = hst.callpoint_hcp,
                callType = DataCBType.CREATE)
        public int create(DpTrans trans, ConfObject[] kp)
                throws DpCallbackException {
            log.info("==> create kp=" + new ConfPath(kp));
            int retVal = Conf.REPLY_ACCUMULATE;
            log.info("<== create retVal=" + retVal);
            return retVal;
        }

        @DataCallback(callPoint = hst.callpoint_hcp,
                callType = DataCBType.REMOVE)
        public int remove(DpTrans trans, ConfObject[] kp)
                throws DpCallbackException {
            log.info("==> remove kp=" + new ConfPath(kp));
            int retVal = Conf.REPLY_ACCUMULATE;
            log.info("<== remove retVal=" + retVal);
            return retVal;
        }
    }

    /**
     * @see DpDataCallback
     */
    public final static class CbIfaceData {
        /* the keypaths we get here will be like :                       */
        /* /hosts/host{hostname}/interfaces/interface{ifname}/ip         */
        /*   [6]  [5]   [4]     [3]        [2]       [1]     [0]         */

        @DataCallback(callPoint = hst.callpoint_icp, callType = DataCBType
                .GET_ELEM)
        public ConfValue getElem(final DpTrans trans, final ConfObject[] kp)
                throws DpCallbackException {
            log.info("==> getElem kp=" + new ConfPath(kp));
            ConfValue retVal = null;
            String hostName = ((ConfKey) kp[4]).elementAt(0).toString();
            log.trace("hostName=" + hostName);
            HostDb.Host host = HostDb.getInstance().findHost(hostName);
            String ifaceName = ((ConfKey) kp[1]).elementAt(0).toString();
            log.trace("ifaceName=" + ifaceName);
            HostDb.Interface iface = HostDb.getInstance().findIface(host,
                    ifaceName);
            if (iface != null) {
                switch (((ConfTag) kp[0]).getTagHash()) {
                    case hst.hst_name:
                        retVal = new ConfBuf(iface.name);
                        break;
                    case hst.hst_ip:
                        try {
                            retVal = new ConfIPv4(iface.ip);
                        } catch (ConfException e) {
                            DpCallbackException ex = new DpCallbackException(e);
                            log.error(ex);
                            throw ex;
                        }
                        break;
                    case hst.hst_mask:
                        try {
                            retVal = new ConfIPv4(iface.mask);
                        } catch (ConfException e) {
                            DpCallbackException ex = new DpCallbackException(e);
                            log.error(ex);
                            throw ex;
                        }
                        break;
                    case hst.hst_enabled:
                        retVal = new ConfBool(iface.enabled);
                        break;
                    default:
                        DpCallbackException ex = new DpCallbackException
                                ("HERE " + ((ConfTag) kp[0]).getTagHash());
                        log.error(ex);
                        throw ex;
                }
            }
            log.info("<== getElem retVal=" + (retVal == null ? null : retVal));
            return retVal;
        }

        /* keypath here will look like */
        /* /hosts/host{myhostname}/interfaces/interface */
        @DataCallback(callPoint = hst.callpoint_icp, callType = DataCBType
                .ITERATOR)
        public Iterator<Object> iterator(final DpTrans trans,
                                         final ConfObject[] kp) throws
                DpCallbackException {
            log.info("==> iterator kp=" + new ConfPath(kp));
            String hostName = ((ConfKey) kp[2]).elementAt(0).toString();
            final Iterator<Object> retVal = HostDb.getInstance()
                    .getInterfaceIterator(hostName);

            log.info("<== iterator retVal=" + retVal);
            return retVal;
        }

        @DataCallback(callPoint = hst.callpoint_icp, callType = DataCBType
                .GET_NEXT)
        public ConfKey getIteratorKey(final DpTrans trans,
                                      final ConfObject[] kp,
                                      final Object obj) throws
                DpCallbackException {
            log.info("==> getIteratorKey kp=" + new ConfPath(kp) +
                    " obj=" + obj.toString());
            final ConfObject val = new ConfBuf(((HostDb.Interface) obj)
                    .name);
            log.info("<== getIteratorKey val=" + val);
            return new ConfKey(val);
        }

        @DataCallback(callPoint = hst.callpoint_icp,
                callType = DataCBType.SET_ELEM)
        public int setElem(DpTrans trans, ConfObject[] kp, ConfValue val)
                throws DpCallbackException {
            log.info("==> setElem kp=" + new ConfPath(kp) +
                    " val=" + val.toString());
            int retVal = Conf.REPLY_ACCUMULATE;
            log.info("<== setElem retVal=" + retVal);
            return retVal;
        }

        @DataCallback(callPoint = hst.callpoint_icp,
                callType = DataCBType.CREATE)
        public int create(DpTrans trans, ConfObject[] kp)
                throws DpCallbackException {
            log.info("==> create kp=" + new ConfPath(kp));
            int retVal = Conf.REPLY_ACCUMULATE;
            log.info("<== create retVal=" + retVal);
            return retVal;
        }

        @DataCallback(callPoint = hst.callpoint_icp,
                callType = DataCBType.REMOVE)
        public int remove(DpTrans trans, ConfObject[] kp)
                throws DpCallbackException {
            log.info("==> remove kp=" + new ConfPath(kp));
            int retVal = Conf.REPLY_ACCUMULATE;
            log.info("<== remove retVal=" + retVal);
            return retVal;
        }
    }

    public final static class DpRunnable implements Runnable {
        public void run() {
            log.info("==> run");
            try {
                final Socket ctrl_socket = new Socket(CONFD_HOST, Conf.PORT);
                final Dp dataProv = new Dp("action_daemon", ctrl_socket,
                        false, 2, MAX_SESSIONS + 2, 60L, TimeUnit.SECONDS,
                        new SynchronousQueue(), true);

                dataProv.registerAnnotatedCallbacks(new Hosts.CbTrans());
                dataProv.registerAnnotatedCallbacks(new Hosts.CbDb());
                dataProv.registerAnnotatedCallbacks(new Hosts.CbHostData());
                dataProv.registerAnnotatedCallbacks(new Hosts.CbIfaceData());

                dataProv.registerDone();

                while (true) {
                    dataProv.read();
                }
            } catch (Exception e) {
                log.warn("read() function interrupted");
                daemonRetVal = Conf.REPLY_ERR;
                log.error(e);
            }
            log.info("<== run");
        }
    }

    public final static int createDaemon() {
        log.info("==> createDaemon daemonRetVal=" + daemonRetVal);

        try {
            final Thread dpTh = new Thread(new DpRunnable());
            dpTh.start();
            final Thread cliTh = new Thread(new HostCli());
            cliTh.start();
            cliTh.join();
            System.exit(0); // TODO
            dpTh.join();
        } catch (Exception e) {
            log.error(e);
            daemonRetVal = Conf.REPLY_ERR;
        }

        log.info("<== createDaemon daemonRetVal=" + daemonRetVal);
        return daemonRetVal;
    }

    public static void main(final String args[]) {
        log.info("==> main");
        int exitStatus = 0;

        if (createDaemon() != Conf.REPLY_OK) {
            log.fatal("Failed to create daemon, exiting!");
            exitStatus = 1;
        }

        log.info("<== main exitStatus=" + exitStatus);
        System.exit(exitStatus);
    }
}
