/*********************************************************************
 * ConfD Actions intro example, JAVA version
 * Implements a data provider for operational data and action.
 *
 * (C) 2018 Tail-f Systems
 * Permission to use this code as a starting point hereby granted
 *
 * See the README file for more information
 ********************************************************************/

import com.tailf.conf.*;
import com.tailf.dp.Dp;
import com.tailf.dp.DpCallbackException;
import com.tailf.dp.DpTrans;
import com.tailf.dp.annotations.DataCallback;
import com.tailf.dp.annotations.TransCallback;
import com.tailf.dp.proto.DataCBType;
import com.tailf.dp.proto.TransCBType;
import com.tailf.maapi.Maapi;
import com.tailf.maapi.MaapiCursor;
import org.apache.log4j.Logger;

import java.io.IOException;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.Socket;
import java.util.Arrays;

public final class Hooks {
    private static final Logger log = Logger.getRootLogger();
    private static final String CONFD_HOST = "127.0.0.1";

    public static class HooksTrans {

        private Maapi maapi;

        HooksTrans(Maapi maapi) {
            this.maapi = maapi;
        }

        @TransCallback(callType = {TransCBType.INIT})
        public void init(DpTrans trans) throws IOException, ConfException {
            log.debug("==> init");

            Integer td = (Integer) trans.getTransactionUserOpaque();
            log.debug("td=" + td);
            if (td == null) {
                td = 0;
                maapi.attach(trans.getTransaction(), hooks.hash);
            }
            td = td + 1;
            trans.setTransactionUserOpaque(td);

            log.debug("<== init td=" + td);
        }

        @TransCallback(callType = {TransCBType.FINISH})
        public void finish(DpTrans trans) throws IOException, ConfException {
            log.debug("==> finish");

            Integer td = (Integer) trans.getTransactionUserOpaque();
            log.debug("td=" + td);
            td = td - 1;
            if (td == 0) {
                maapi.detach(trans.getTransaction());
            }

            log.debug("<== finish td=" + td);
        }

    }

    public static class HooksCb {

        private Maapi maapi;

        HooksCb(Maapi maapi) {
            this.maapi = maapi;
        }

        @DataCallback(callPoint = hooks.callpoint_ip_mask, callType =
                DataCBType.CREATE)
        public int create(DpTrans trans, ConfObject[] kp) throws
                DpCallbackException {
            log.debug("==> create kp=" + new ConfPath(kp));
            int retVal = Conf.REPLY_ERR;

            log.warn("This 'create' hook method should not be called as" +
                    "create is invoked only on list elements!");

            log.debug("<== create retVal=" + retVal);
            return retVal;
        }


        @DataCallback(callPoint = hooks.callpoint_ip_mask, callType =
                DataCBType.REMOVE)
        public int remove(DpTrans trans, ConfObject[] kp) throws
                DpCallbackException {
            log.debug("==> remove kp=" + new ConfPath(kp));
            int retVal = Conf.REPLY_OK;

            log.info("ip_mask: Remove hook detected, no change done.");

            log.debug("<== remove retVal=" + retVal);
            return retVal;
        }

        @DataCallback(callPoint = hooks.callpoint_ip_mask, callType =
                DataCBType.SET_ELEM)
        public int setElem(DpTrans trans, ConfObject[] kp, ConfValue newVal)
                throws
                ConfException, IOException {
            log.debug("==> setElem kp=" + new ConfPath(kp));
            int retVal = Conf.REPLY_OK;
            ConfObject[] kpTrimmed = Arrays.copyOfRange(kp, 1, kp.length);
            String path = new ConfPath(kpTrimmed).toString();

            ConfIPv4 ip = null, netmask = null;
            log.info("ip_mask: Host path=" + path);
            if (maapi.exists(trans.getTransaction(), path + "/ip")) {
                log.trace("ip_mask: ip exits");
                ip = (ConfIPv4) maapi.getElem(trans.getTransaction(),
                        path + "/ip");
            }
            if (maapi.exists(trans.getTransaction(), path + "/netmask")) {
                log.trace("ip_mask: netmask exits");
                netmask = (ConfIPv4) maapi.getElem(trans.getTransaction()
                        , path + "/netmask");
            }
            if (ip != null && netmask != null) {
                log.debug("ip=" + ip + " netmask=" + netmask);
                if (!maapi.exists(trans.getTransaction(), path + "/gw")) {
                    byte ipBytes[] = ip.getAddress().getAddress();
                    byte netmaskBytes[] = netmask.getAddress().getAddress();
                    assert (ipBytes.length == 4);
                    assert (netmaskBytes.length == 4);
                    byte[] gwBytes = new byte[4];
                    for (int i = 0; i < ipBytes.length; i++) {
                        gwBytes[i] = (byte) (ipBytes[i] & netmaskBytes[i]);
                    }
                    gwBytes[3] |= 1;
                    ConfIPv4 gw = new ConfIPv4(gwBytes[0], gwBytes[1],
                            gwBytes[2], gwBytes[3]);
                    log.debug("gw=" + gw);
                    maapi.setElem(trans.getTransaction(), gw, path + "/gw");
                } else {
                    log.info("ip_mask: gw for host " + path + " already " +
                            "set.");
                }
            } else {
                log.info("ip or netmask not set!");
            }

            log.debug("<== setElem retVal=" + retVal);
            return retVal;
        }

        private void convertIpElement(final int th, ConfKey key, final String
                elem) throws IOException, ConfException {
            log.debug("==> convertIpElement th=" + th);
            if (maapi.exists(th, "/hosts{%x}/%s", key, elem)) {
                ConfIPv4 val = (ConfIPv4) maapi.getElem(th, "/hosts{%x}/%s",
                        key, elem);
                int[] ip = val.getRawAddress();
                int ip6[] = new int[8];
                ip6[5] = 0xFFFF;
                ip6[6] = (ip[1] & 0xFF) + ((ip[0] << 8) & 0xFF00);
                ip6[7] = (ip[3] & 0xFF) + ((ip[2] << 8) & 0xFF00);
                ConfIPv6 ip6Val = new ConfIPv6(ip6[0], ip6[1], ip6[2], ip6[3],
                        ip6[4], ip6[5], ip6[6], ip6[7]);
                log.debug("ip ipv4=" + val);
                log.debug("ip ipv6=" + ip6Val);
                maapi.setElem(th, ip6Val, "/hosts_ipv6{%x}/%s", key, elem);
            }

            log.debug("<== convertIpElement");
        }

        private int createIpv6Hosts(final int th) {
            log.debug("==> createIpv6Hosts th=" + th);
            int retVal = Conf.REPLY_OK;

            try {
                MaapiCursor c = maapi.newCursor(th, "/hosts");
                ConfKey next = maapi.getNext(c);
                while (next != null) {
                    log.trace("next=" + next);
                    if (!maapi.exists(th, "/hosts_ipv6{%x}", next)) {
                        maapi.create(th, "/hosts_ipv6{%x}", next);
                    }
                    convertIpElement(th, next, "ip");
                    convertIpElement(th, next, "gw");
                    next = maapi.getNext(c);
                }
            } catch (Exception e) {
                log.fatal("failed to create ipv6 host!", e);
                retVal = Conf.REPLY_ERR;
            }

            log.debug("<== createIpv6Hosts retVal=" + retVal);
            return retVal;
        }

        private int deleteIpv6Hosts(final int th) {

            log.debug("==> deleteIpv6Hosts th=" + th);
            int retVal = Conf.REPLY_OK;

            try {
                MaapiCursor c = maapi.newCursor(th, "/hosts_ipv6");
                ConfKey next = maapi.getNext(c);
                log.trace("next=" + next);
                while (next != null) {
                    log.trace("next=" + next);
                    if (!maapi.exists(th, "/hosts{%x}", next)) {
                        log.trace("Ipv4 host does not exists, deleting ipv6 " +
                                "host");
                        maapi.delete(th, "/hosts_ipv6{%x}", next);
                    }
                    next = maapi.getNext(c);
                }
            } catch (Exception e) {
                log.fatal("failed to delete ipv6 host!", e);
                retVal = Conf.REPLY_ERR;
            }

            log.debug("<== deleteIpv6Hosts retVal=" + retVal);
            return retVal;
        }


        @DataCallback(callPoint = hooks.callpoint_trans_hosts, callType =
                DataCBType.WRITE_ALL)
        public int writeAll(DpTrans trans, ConfObject[] kp)
                throws DpCallbackException {
            log.debug("==> writeAll");
            int retVal = Conf.REPLY_OK;

            if (Conf.REPLY_OK != createIpv6Hosts(trans.getTransaction())) {
                log.fatal("Failed to create ipv6 hosts!");
                retVal = Conf.REPLY_ERR;
            } else {
                if (Conf.REPLY_OK != deleteIpv6Hosts(trans.getTransaction())) {
                    log.fatal("Failed to deelte ipv6 hosts!");
                    retVal = Conf.REPLY_ERR;
                }
            }

            log.debug("<== writeAll retVal=" + retVal);
            return retVal;
        }

    }

    public final static int createDaemon() {
        log.info("==> createDaemon");
        int daemonRetVal = Conf.REPLY_OK;

        try {

            Maapi maapi = new Maapi(new Socket(CONFD_HOST, Conf.PORT));
            // init and connect control socket
            Socket ctrlSocket = new Socket(CONFD_HOST, Conf.PORT);
            Dp dp = new Dp("hooks", ctrlSocket);

            // register the  callbacks
            dp.registerAnnotatedCallbacks(new HooksTrans(maapi));
            dp.registerAnnotatedCallbacks(new HooksCb(maapi));
            dp.registerDone();

            log.info("Hooks example Started");
            try {
                while (true) dp.read(); // read input from the control socket
            } catch (Exception e) {
                System.out.println("ConfD terminated");
            }

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