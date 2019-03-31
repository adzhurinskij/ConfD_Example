/*********************************************************************
 * ConfD threading intro example, JAVA version
 * Implements a data provider for operational data and action.
 *
 * (C) 2016 Tail-f Systems
 * Permission to use this code as a starting point hereby granted
 *
 * See the README file for more information
 ********************************************************************/

import com.tailf.conf.*;
import com.tailf.dp.*;
import com.tailf.dp.annotations.ActionCallback;
import com.tailf.dp.annotations.DataCallback;
import com.tailf.dp.annotations.TransCallback;
import com.tailf.dp.proto.ActionCBType;
import com.tailf.dp.proto.DataCBType;
import com.tailf.dp.proto.TransCBType;
import com.tailf.maapi.Maapi;
import com.tailf.maapi.MaapiCursor;
import com.tailf.maapi.MaapiUserSessionFlag;
import org.apache.log4j.Logger;

import java.io.IOException;
import java.net.InetAddress;
import java.net.Socket;
import java.util.Arrays;
import java.util.Iterator;
import java.util.List;
import java.util.concurrent.SynchronousQueue;
import java.util.concurrent.TimeUnit;

public final class ThrDaemon {
    private static final Logger log = Logger.getRootLogger();
    private static final int MAX_SESSIONS = 10;
    private static final String CONFD_HOST = "127.0.0.1";
    // Dummy data for PROC data provider callbacks (GET_NEXT, GET_ELEM)
    private static final List PROC_ENTRIES = Arrays.asList(
            new ProcInfo(1, 37),
            new ProcInfo(5, 19),
            new ProcInfo(17, 42));
    private static int daemonRetVal = Conf.REPLY_OK;
    private static int attempts;

    private ThrDaemon() throws RuntimeException {
        throw new RuntimeException("Cannot instantiate utility class!");
    }

    /**
     * Structure holding ProcInfo fields
     */
    private final static class ProcInfo {
        private final long pid;
        private final long cpu;

        public long getPid() {
            return pid;
        }

        public long getCpu() {
            return cpu;
        }

        public ProcInfo(final long pid, final long cpu) {
            this.pid = pid;
            this.cpu = cpu;
        }
    }

    /**
     * @see DpTransCallback
     */
    public final static class CbTrans {
        @TransCallback(callType = TransCBType.INIT)
        public void initTrans(final DpTrans trans) throws DpCallbackException {
            log.info("==> initTrans");
            log.info("<== initTrans");
        }

        @TransCallback(callType = TransCBType.FINISH)
        public void finishTrans(final DpTrans trans) throws
                DpCallbackException {
            log.info("==> finishTrans");
            log.info("<== finishTrans");
        }
    }

    /**
     * @see DpDataCallback
     */
    public final static class CbProcData {
        @DataCallback(callPoint = model.callpoint_proc, callType = DataCBType
                .GET_ELEM)
        public ConfValue getElem(final DpTrans trans, final ConfObject[]
                keyPath)
                throws DpCallbackException {
            log.info("==> getElem keyPath=" + new ConfPath(keyPath));
            ConfValue retVal = null;

            final long pid = ((ConfUInt32) ((ConfKey) keyPath[1]).elementAt(0))
                    .longValue();
            log.trace("pid=" + pid);
            ProcInfo proc = null;
            for (final Object i : PROC_ENTRIES) {
                if (((ProcInfo) i).getPid() == pid) {
                    proc = (ProcInfo) i;
                    break;
                }
            }
            log.debug("proc=" + proc);

            if (proc != null) {
                final int hash = ((ConfTag) keyPath[0]).getTagHash();
                switch (hash) {
                    case model.model_pid:
                        retVal = new ConfUInt32(proc.getPid());
                        break;
                    case model.model_cpu:
                        retVal = new ConfUInt32(proc.getCpu());
                        break;
                    default:
                        log.error("Wrong hash tag encountered hash=" + hash);
                        throw new DpCallbackException(model.callpoint_proc +
                                " wrong hash tag!");
                }
            }

            log.info("<== getElem retVal=" + (retVal == null ? null : retVal));
            return retVal;
        }

        @DataCallback(callPoint = model.callpoint_proc, callType = DataCBType
                .ITERATOR)
        public Iterator<Object> iterator(final DpTrans trans,
                                         final ConfObject[] keyPath) throws
                DpCallbackException {
            log.info("==> iterator keyPath=" + new ConfPath(keyPath));

            final Iterator<Object> retVal = PROC_ENTRIES.iterator();

            log.info("<== iterator retVal=" + retVal);
            return retVal;
        }

        @DataCallback(callPoint = model.callpoint_proc, callType = DataCBType
                .GET_NEXT)
        public ConfKey getIteratorKey(final DpTrans trans,
                                      final ConfObject[] keyPath,
                                      final Object obj) throws
                DpCallbackException {
            log.info("==> getIteratorKey keyPath=" + new ConfPath(keyPath) +
                    " obj=" + obj.toString());

            final ConfObject val = new ConfUInt32(((ProcInfo) obj).getPid());

            log.info("<== getIteratorKey val=" + val);
            return new ConfKey(val);
        }
    }

    /**
     * @see DpActionCallback
     */
    public final static class CbSleepAction {
        @ActionCallback(callPoint = model.actionpoint_sleep, callType =
                ActionCBType.ACTION)
        public ConfXMLParam[] doActionSleep(final DpActionTrans trans,
                                            final ConfTag name,
                                            final ConfObject[] keyPath,
                                            final ConfXMLParam[] params)
                throws DpCallbackException {
            log.info("==> doActionSleep keyPath=" + new ConfPath(keyPath));
            ConfXMLParam[] retVal = null;

            final long start = System.currentTimeMillis() / 1000;
            final long sleepTime = ((ConfUInt32) (params[0].getValue()))
                    .longValue();
            // remember current thread for possible abort()
            trans.setTransactionUserOpaque(Thread.currentThread());

            try {
                trans.actionSetTimeout((int) (sleepTime + 3));
                Thread.sleep(sleepTime * 1000);
                final long stop = System.currentTimeMillis() / 1000;
                retVal = new ConfXMLParam[1];
                retVal[0] = new ConfXMLParamValue(model.hash, model.model_slept,
                        new ConfUInt32(stop - start));
            } catch (IOException e) {
                log.error(e);
            } catch (InterruptedException e) {
                log.error(e);
            }

            log.info("<== doActionSleep retVal=" + (retVal == null ? null :
                    Arrays.toString(retVal)));
            return retVal;
        }

        @ActionCallback(callPoint = model.actionpoint_sleep, callType =
                ActionCBType.INIT)
        public void initActionSleep(final DpActionTrans trans) throws
                DpCallbackException {
            log.info("==> initActionSleep");
            log.info("<== initActionSleep");
        }

        @ActionCallback(callPoint = model.actionpoint_sleep, callType =
                ActionCBType.ABORT)
        public void abortActionSleep(final DpActionTrans trans) throws
                DpCallbackException {
            log.info("==> abortActionSleep");
            final Object opaque = trans.getTransactionUserOpaque();
            if (opaque instanceof Thread) {
                log.debug("Aborting action thread " + ((Thread) opaque)
                        .getName());
                ((Thread) opaque).interrupt();
            } else {
                log.error("Cannot abort action thread, opaque not set!");
                throw new DpCallbackException("Cannot abort action thread");
            }
            log.info("<== abortActionSleep");
        }
    }

    /**
     * @see DpActionCallback
     */
    public final static class CbTotalAction {
        @ActionCallback(callPoint = model.actionpoint_totals, callType =
                ActionCBType.ACTION)
        public ConfXMLParam[] doTotals(final DpActionTrans trans,
                                       final ConfTag name,
                                       final ConfObject[] keyPath,
                                       final ConfXMLParam[] params) throws
                DpCallbackException {
            log.info("==> doTotals keyPath=" + new ConfPath(keyPath));


            // Start MAAPI session for admin user, originating from localhost
            ConfXMLParam[] retVal = null;
            try {
                // Setup socket to server
                final Socket socket = new Socket(CONFD_HOST, Conf.PORT);
                final Maapi maapi = new Maapi(socket);
                maapi.startUserSession("admin",
                        InetAddress.getByName(CONFD_HOST),
                        "maapi", new String[]{"admin"},
                        MaapiUserSessionFlag.PROTO_TCP);
                // Start a read transaction towards the running configuration.
                final int maapiTrans = maapi.startTrans(Conf.DB_RUNNING, Conf
                        .MODE_READ);
                // Set the namespace for the upcoming data operations
                maapi.setNamespace(maapiTrans, "http://tail-f" +
                        ".com/ns/example/model");
                final String path = "/model:dm/proc";
                final MaapiCursor cursor = maapi.newCursor(maapiTrans, path);

                ConfKey key = maapi.getNext(cursor);
                long totalCpu = 0;
                long numProc = 0;
                while (key != null) {
                    log.debug("key=" + key.toString());
                    final ConfUInt32 val = (ConfUInt32) maapi.getElem
                            (maapiTrans,
                                    path + key.toString() + "/cpu");
                    totalCpu += val.longValue();
                    numProc++;
                    log.debug("totalCpu=" + totalCpu);
                    key = maapi.getNext(cursor);
                }
                // The transaction and user session is automatically
                // ended when the socket is closed.
                socket.close();
                retVal = new ConfXMLParam[2];
                retVal[0] = new ConfXMLParamValue(model.hash, model
                        .model_num_procs,
                        new ConfUInt32(numProc));
                retVal[1] = new ConfXMLParamValue(model.hash, model
                        .model_total_cpu,
                        new ConfUInt32(totalCpu));

            } catch (IOException e) {
                log.error(e);
            } catch (ConfException e) {
                log.error(e);
            }

            log.info("<== doTotals retVal=" + (retVal == null ? null : Arrays
                    .toString(retVal)));
            return retVal;
        }

        @ActionCallback(callPoint = model.actionpoint_totals, callType =
                ActionCBType.INIT)
        public void initActionTotals(final DpActionTrans trans) throws
                DpCallbackException {
            log.info("==> initActionTotals");
            log.info("<== initActionTotals");
        }
    }

    public final static int createDaemon() {
        log.info("==> createDaemon daemonRetVal=" + daemonRetVal);

        try {
            final Socket ctrl_socket = new Socket(CONFD_HOST, Conf.PORT);
            final Dp dataProv = new Dp("thr_daemon", ctrl_socket, false, 2,
                    MAX_SESSIONS + 2,
                    60L, TimeUnit.SECONDS, new SynchronousQueue(), true);
            dataProv.registerAnnotatedCallbacks(new ThrDaemon.CbSleepAction());
            dataProv.registerAnnotatedCallbacks(new ThrDaemon.CbTotalAction());
            dataProv.registerAnnotatedCallbacks(new ThrDaemon.CbProcData());
            dataProv.registerAnnotatedCallbacks(new ThrDaemon.CbTrans());
            dataProv.registerDone();

            final Thread dpTh = new Thread(new Runnable() {
                public void run() {
                    try {
                        while (true) {
                            attempts = 0;
                            dataProv.read();
                        }
                    } catch (Exception e) {
                        log.warn("read() function interrupted");
                        daemonRetVal = Conf.REPLY_ERR;
                        log.error(e);
                    }
                }
            });

            dpTh.start();
            dpTh.join();
        } catch (Exception e) {
            log.error(e);
            daemonRetVal = Conf.REPLY_ERR;
        }

        log.info("<== createDaemon retVal=" + daemonRetVal);
        return daemonRetVal;
    }

    public static void main(final String args[]) {
        log.info("==> main");
        final int maxAttempts = 5;
        int exitStatus = 0;

        while (true) {
            if (createDaemon() != Conf.REPLY_OK) {
                attempts++;
                if (attempts >= maxAttempts) {
                    log.warn("Failed to create daemon, giving up attempts=" +
                            attempts);
                    exitStatus = 2;
                    break;
                } else {
                    log.warn("Failed to create daemon, will retry... " +
                            "(attempts=" + attempts + ")");
                    try {
                        Thread.sleep(3000);
                    } catch (InterruptedException e) {
                        log.error(e);
                        exitStatus = 3;
                        break;
                    }
                }
                log.warn("Daemon terminated, restarting");
            }
        }

        log.info("<== main exitStatus=" + exitStatus);
        System.exit(exitStatus);
    }
}
