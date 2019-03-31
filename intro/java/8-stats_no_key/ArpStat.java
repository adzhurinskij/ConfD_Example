/*********************************************************************
 * ConfD Stats (no keys) intro example,  JAVA version
 * Implements an operational data provider for list without keys
 * See 6.11. Operational data lists without keys
 *
 * (C) 2016 Tail-f Systems
 * Permission to use this code as a starting point hereby granted
 *
 * See the README file for more information
 ********************************************************************/

import com.tailf.conf.*;
import com.tailf.dp.Dp;
import com.tailf.dp.DpCallbackException;
import com.tailf.dp.DpTrans;
import com.tailf.dp.annotations.DataCallback;
import com.tailf.dp.proto.DataCBType;
import org.apache.log4j.Logger;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.Socket;
import java.util.*;

public class ArpStat {
    private static final String HOST = "127.0.0.1";
    private static Logger log = Logger.getLogger(ArpStat.class);

    private static class ArpEntry {
        private ConfIPv4 ip;
        private String hwaddr, ifname;
        private boolean permanent, published;

        public ArpEntry(String ip, String hwaddr, boolean permanent,
                        boolean published, String ifname) {
            try {
                this.ip = new ConfIPv4(ip);
            } catch (ConfException e) {
                log.error(e);
            }
            this.hwaddr = hwaddr;
            this.permanent = permanent;
            this.published = published;
            this.ifname = ifname;
        }

        public ConfIPv4 getIPAddress() {
            return this.ip;
        }
        public boolean getPermanent() {
            return this.permanent;
        }
        public boolean getPublished() {
            return this.published;
        }
        public String getHWAddress() {
            return this.hwaddr;
        }
        public String getIfName() {
            return this.ifname;
        }
    }

    protected static class StatsCb {

        // for each ArpEntry we keep map, key is 64bit integer
        // that can be used as artificial key for key-less list
        private Map entries = new HashMap();
        private long lastPop = -1;

        private void populateEntries() {
            log.info("==> populateEntries");
            // refresh cache if its older than 3 secs
            long now = Calendar.getInstance().getTimeInMillis() / 1000;
            if (lastPop == -1 || lastPop + 3 <= now) {
                lastPop = now;
                entries = new HashMap();
                try {
                    String s;
                    Process p = Runtime.getRuntime().exec("arp -an");
                    BufferedReader stdInput = new BufferedReader(
                            new InputStreamReader(p.getInputStream()));
                    // read the output from the command
                    long entryId = 123; //key is long value
                    while ((s = stdInput.readLine()) != null) {
                        processArpLine(s, entryId++);
                    }
                    stdInput.close();
                } catch (IOException e) {
                    log.error(e);
                }
            }
            log.info("<== populateEntries");
        }

        private void processArpLine(String s, long entryId) {
            String[] toks = s.split(" ");
            if (toks.length >= 4) {
                String ss = toks[1];
                String ip = ss.substring(
                        1, ss.length()).substring(0, ss.length() - 2);
                String hwaddr = toks[3];
                if (hwaddr.compareTo("<incomplete>") != 0) {
                    String ifname = toks[toks.length - 1];
                    boolean permanent = false;
                    boolean published = false;
                    for (int i = 4; i < toks.length; i++) {
                        if (toks[i].compareTo("PERM") == 0) {
                            permanent = true;
                        }
                        if (toks[i].compareTo("PUB") == 0) {
                            published = true;
                        }
                    }
                    entries.put(entryId, new ArpEntry(ip, hwaddr,
                            permanent, published,
                            ifname));
                }
            }
        }

        /**
         * @see DpDataCallback
         */
        @DataCallback(callPoint = arpe.callpoint_arpe2,
                callType = {DataCBType.ITERATOR})
        public Iterator<Object> iterator(DpTrans trans, ConfObject[] kp)
                throws DpCallbackException {
            log.info("==> iterator");
            populateEntries();
            log.info("<== iterator entries.size()=" + entries.size());
            //iterate through artificial ids (64 bit integers)
            return entries.keySet().iterator();
        }

        @DataCallback(callPoint = arpe.callpoint_arpe2,
                callType = {DataCBType.EXISTS_OPTIONAL})
        public boolean existsOptional(DpTrans trans, ConfObject[] kp)
                throws DpCallbackException {
            log.info("==> existsOptional");
            ArpEntry e = (ArpEntry) entries.get(((ConfInt64) ((ConfKey)
                    kp[1]).elementAt(0)).longValue());
            boolean retVal = (e == null);
            log.info("<== existsOptional retVal=" + retVal);
            return retVal;
        }

        @DataCallback(callPoint = arpe.callpoint_arpe2,
                callType = {DataCBType.GET_NEXT})
        public ConfKey getKey(DpTrans trans, ConfObject[] kp, Object obj)
                throws DpCallbackException {
            log.info("==> getKey");
            // convert iterator object (value) to key - 64 bit integer
            ConfInt64 c = new ConfInt64((Long) obj);
            ConfKey key = new ConfKey(new ConfObject[]{c});
            log.info("<== getKey");
            return key;
        }

        @DataCallback(callPoint = arpe.callpoint_arpe2,
                callType = {DataCBType.GET_ELEM})
        public ConfValue getElem(DpTrans trans, ConfObject[] kp) {
            log.info("==> getElem");
            ConfValue retVal = null;
            long entryKey = ((ConfInt64) (((ConfKey) kp[1]).elementAt(0)))
                    .longValue();
            ArpEntry e = (ArpEntry) entries.get(entryKey);
            ConfTag leaf = (ConfTag) kp[0];
            switch (leaf.getTagHash()) {
                case arpe.arpe_ip:
                    retVal = e.getIPAddress();
                    break;
                case arpe.arpe_hwaddr:
                    retVal = new ConfBuf(e.getHWAddress());
                    break;
                case arpe.arpe_permanent:
                    retVal = new ConfBool(e.getPermanent());
                    break;
                case arpe.arpe_published:
                    retVal = new ConfBool(e.getPublished());
                    break;
                default:
                    break;
            }
            log.info("<== getElem");
            return retVal;
        }
    }

    static public void main(String args[]) throws Exception {
        log.info("==> main");
        // create new control socket
        Socket ctrlSocket = new Socket(HOST, Conf.PORT);
        // init and connect control socket
        Dp dp = new Dp("arpstats", ctrlSocket);
        // register the stats callbacks
        dp.registerAnnotatedCallbacks(new StatsCb());
        /* register the validation callbacks and valpoints */
        dp.registerDone();

        log.info("ArpStat (no keys) started");
        // read input from the control socket
        try {
            while (true) {
                dp.read();
            }
        } catch (Exception e) {
            log.error(e);
        }
        log.info("<== main");
    }
}
