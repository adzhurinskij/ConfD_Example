/*********************************************************************
 * ConfD Subscriber intro example, JAVA version
 * Implements a DHCP server adapter
 *
 * (C) 2016 Tail-f Systems
 * Permission to use this code as a starting point hereby granted
 *
 * See the README file for more information
 ********************************************************************/

import com.tailf.cdb.Cdb;
import com.tailf.cdb.CdbSession;
import com.tailf.cdb.CdbSubscription;
import com.tailf.cdb.CdbSubscriptionSyncType;
import com.tailf.conf.*;
import com.tailf.proto.ConfEString;
import org.apache.log4j.Logger;

import java.io.File;
import java.io.IOException;
import java.io.PrintWriter;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.SocketAddress;
import java.nio.channels.SelectionKey;
import java.nio.channels.Selector;
import java.nio.channels.SocketChannel;
import java.nio.channels.spi.SelectorProvider;
import java.util.Iterator;

public final class DhcpConf {

    private static Logger log = Logger.getLogger(DhcpConf.class);

    private static final dhcpd DHCPD_NS = new dhcpd();
    private static final String HOSTNAME = "localhost";
    private static final String DHCP_CONF = "dhcpd.conf";
    private static final String DHCP_CONF_TMP = "dhcpd.conf.tmp";

    /**
     * Helper function to rename file
     *
     * @param oldName old filename
     * @param newName new filename
     */
    private static void rename(final String oldName, final String newName) {
        log.info("=> rename oldName=" + oldName + " newName=" + newName);
        final File oldFile = new File(oldName);
        final File newFile = new File(newName);
        oldFile.renameTo(newFile);
        log.info("<= rename");
    }

    /**
     * Helper function to convert ConfDuration to seconds
     *
     * @param d ConfDuration value
     * @return value in seconds
     */
    private static int durationToSec(final ConfDuration d) {
        return (d.getSec() +
                (d.getMin() * 60) +
                (d.getHour() * 60 * 60) +
                (d.getDay() * 60 * 60 * 24) +
                (d.getMonth() * 60 * 60 * 24 * 30) +
                (d.getYear() * 60 * 60 * 24 * 365));
    }

    private static void doSubnet(CdbSession cdbSession, final PrintWriter
            writer) throws ConfException, IOException {
        log.info("==> doSubnet");

        ConfIPv4 ip = (ConfIPv4) cdbSession.getElem("net");
        writer.print("subnet " + ip.getAddress().getHostAddress());
        ip = (ConfIPv4) cdbSession.getElem("mask");
        writer.println(" netmask " + ip.getAddress().getHostAddress() + " {");
        if (cdbSession.exists("range")) {
            writer.print(" range ");
            ConfBool bool = (ConfBool) cdbSession.getElem("range/dynamicBootP");
            if (bool.booleanValue()) {
                writer.print(" dynamic-bootp ");
            }
            ip = (ConfIPv4) cdbSession.getElem("range/lowAddr");
            writer.print(" " + ip.getAddress().toString() + " ");
            ip = (ConfIPv4) cdbSession.getElem("range/hiAddr");
            writer.println(" " + ip.getAddress().toString() + " ");
        }
        final ConfValue routers = cdbSession.getElem("routers");
        if (null != routers) {
            writer.println("option routers " + routers.toString().replace(" " +
                    "", "'"));
        }
        final ConfDuration maxLeaseTime = (ConfDuration) cdbSession.getElem
                ("maxLeaseTime");
        writer.println(" max-lease-time " + durationToSec(maxLeaseTime));
        writer.println("};");

        log.info("<== doSubnet");
    }

    /**
     * Connect to CDB, read DHCP configuration and write it to file
     *
     * @param hostname hostname to connect to
     * @param filename filename to write to
     * @throws ConfException
     */
    private static void readConf(final String hostname, final String
            filename) throws ConfException, IOException {
        log.info("==> readConf hostname=" + hostname + " filename=" +
                filename); //can be improved with slf4j
        //crate new Cdb (as existing one may be busy in subscriber)
        final Cdb cdb = new Cdb("read", new Socket(hostname, Conf.PORT));
        final CdbSession cdbSession = cdb.startSession();
        cdbSession.setNamespace(DHCPD_NS);

        final ConfDuration defaultLeaseTime = (ConfDuration) cdbSession
                .getElem("/dhcp/defaultLeaseTime");
        final ConfDuration maxLeaseTime = (ConfDuration) cdbSession.getElem
                ("/dhcp/maxLeaseTime");
        final ConfEnumeration logFacility = (ConfEnumeration) cdbSession
                .getElem("/dhcp/logFacility");

        String logFacilityString = "UNKNOWN";
        switch (logFacility.getOrdinalValue()) {
            case dhcpd.dhcpd_kern:
                logFacilityString = "kern";
                break;
            case dhcpd.dhcpd_mail:
                logFacilityString = "mail";
                break;
            case dhcpd.dhcpd_local7:
                logFacilityString = "local7";
                break;
            default:
                log.warn("Unknown logFacility value=" + logFacility
                        .getOrdinalValue());
                break;
        }

        final PrintWriter writer = new PrintWriter(filename, "UTF-8");
        writer.println("default-lease-time " + durationToSec(defaultLeaseTime));
        writer.println("max-lease-time " + durationToSec(maxLeaseTime));
        writer.println("log-facility " + logFacilityString);

        int n = cdbSession.getNumberOfInstances("/dhcp/SubNets/subNet");
        for (int i = 0; i < n; i++) {
            cdbSession.cd("/dhcp/SubNets/subNet[" + i + "]");
            doSubnet(cdbSession, writer);
        }

        n = cdbSession.getNumberOfInstances
                ("/dhcp/SharedNetworks/sharedNetwork");
        for (int i = 0; i < n; i++) {
            ConfValue v = cdbSession.getElem
                    ("/dhcp/SharedNetworks/sharedNetwork[" + i + "]/name");
            writer.println("shared-network " + v.toString() + " {");
            int m = cdbSession.getNumberOfInstances
                    ("/dhcp/SharedNetworks/sharedNetwork[" + i +
                            "]/SubNets/subNet");
            for (int j = 0; j < m; j++) {
                cdbSession.pushd("/dhcp/SharedNetworks/sharedNetwork[" + i +
                        "]/SubNets/subNet[" + j + "]");
                doSubnet(cdbSession, writer);
                cdbSession.popd();
            }
            writer.println("}");
        }

        writer.close();
        cdbSession.endSession();
        cdb.close();
        log.info("Subscriber Started");
    }

    public static void main(final String args[]) throws Exception {
        // Subscription process through polling support
        // (see documentation for CdbSubscription)
        final SocketChannel sockCh = SocketChannel.open();
        sockCh.configureBlocking(false);
        final SocketAddress sockaddr = new InetSocketAddress(HOSTNAME, Conf
                .PORT);
        sockCh.connect(sockaddr);

        final Cdb cdb = new Cdb("test", sockCh);
        final CdbSubscription sub = cdb.newSubscription();
        final int subIdDhcp = sub.subscribe(1, DHCPD_NS, "/dhcp"); //
        // subscribe on a path
        sub.subscribeDone(); // tell CDB we are ready for notifications
        log.info("Subscriber registered");

        readConf(HOSTNAME, DHCP_CONF_TMP);
        rename(DHCP_CONF_TMP, DHCP_CONF);

        final Selector selector = SelectorProvider.provider().openSelector();
        final SelectionKey keys = sockCh.register(selector, SelectionKey
                .OP_READ);
        final Thread subThread = new Thread(new Runnable() {

            public void run() {
                while (true) {
                    try {
                        selector.select();
                    } catch (IOException e) {
                        e.printStackTrace();
                        return;
                    }
                    log.trace("Selector selected");
                    // Iterate over selectorKeys with available events
                    Iterator selectedKeys = selector.selectedKeys().iterator();
                    while (selectedKeys.hasNext()) {
                        SelectionKey key = (SelectionKey) selectedKeys.next();
                        selectedKeys.remove();

                        if (!key.isValid()) {
                            log.trace("Key not valid");
                            continue;
                        }
                        // Check what event is available and deal with it
                        try {
                            log.trace("Processing key");
                            if (key.isReadable()) {
                                log.trace("Reading subscription points");
                                int[] points = sub.read();
                                if (points.length > 0) { // more appropriate
                                    // check if subIdDhcp is in points
                                    readConf(HOSTNAME, DHCP_CONF_TMP);
                                    log.info("Read new config, updating dhcpd" +
                                            " config");
                                    rename(DHCP_CONF_TMP, DHCP_CONF);
                                }
                                sub.sync(CdbSubscriptionSyncType.DONE_PRIORITY);
                            }
                        } catch (Exception e) {
                            e.printStackTrace();
                            return;
                        }
                    }
                }
            }
        });

        subThread.start();
    }
}
