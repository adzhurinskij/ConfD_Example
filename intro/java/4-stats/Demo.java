/*    -*- Java -*-
 *
 *  Copyright 2007-2016 Tail-F Systems AB. All rights reserved.
 *
 *  This software is the confidential and proprietary
 *  information of Tail-F Systems AB.
 */

import java.io.IOException;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.Socket;
import java.util.*;

import com.tailf.conf.*;
import com.tailf.dp.*;

import com.tailf.dp.annotations.*;
import com.tailf.dp.proto.*;
import com.tailf.maapi.Maapi;
import com.tailf.maapi.MaapiCursor;

import org.apache.log4j.Logger;

public class Demo {
    private static Logger Log = Logger.getLogger(Demo.class);

    static public void main(String args[]) throws Exception {
        /* create maapi instance to be used by the  validate callbacks
           so they could use the maapi instance for attaching to
           started transaction by confd
         */
        Maapi maapi = new Maapi(new Socket("localhost", Conf.PORT));

        // create new control socket
        Socket ctrlSocket = new Socket("127.0.0.1", Conf.PORT);

        // init and connect control socket
        Dp dp = new Dp("arpstats", ctrlSocket);

        // register the stats callbacks
        dp.registerAnnotatedCallbacks(new StatsTrans());
        dp.registerAnnotatedCallbacks(new StatsCb());

        /* register the validation callbacks and valpoints */
        dp.registerAnnotatedCallbacks(new TransValidateCb(maapi));
        dp.registerAnnotatedCallbacks(new IpValpointCb(maapi));
        dp.registerAnnotatedCallbacks(new PortValpointCb(maapi));

        dp.registerDone();
        Log.info("Demo Started");
        // read input from the control socket
        try {
            while (true) dp.read();
        } catch (Exception e) {
            System.out.println("ConfD terminated");
        }

    }

    public static class StatsCb {

        private ArrayList entries = new ArrayList();
        private long lastPop = -1;

        private void populateEntries() {
            // refresh cache if its older than 3 secs
            long now = Calendar.getInstance().getTimeInMillis() / 1000;
            if (lastPop == -1)
                lastPop = now;
            else if (lastPop + 3 > now)
                return;
            else
                lastPop = now;
            entries = new ArrayList();
            try {
                String s;
                Process p = Runtime.getRuntime().exec("arp -an");

                BufferedReader stdInput = new BufferedReader(
                        new InputStreamReader(p.getInputStream()));

                BufferedReader stdError = new BufferedReader(
                        new InputStreamReader(p.getErrorStream()));

                // read the output from the command

                while ((s = stdInput.readLine()) != null) {
                    String[] toks = s.split(" ");
                    if (toks.length < 4)
                        continue;

                    String ss = toks[1];
                    String ip = ss.substring(
                            1, ss.length()).substring(0, ss.length() - 2);
                    String hwaddr = toks[3];
                    if (hwaddr.compareTo("<incomplete>") == 0)
                        continue;
                    String ifname = toks[toks.length - 1];
                    boolean permanent = false;
                    boolean published = false;
                    for (int i = 4; i < toks.length; i++) {
                        if (toks[i].compareTo("PERM") == 0)
                            permanent = true;
                        if (toks[i].compareTo("PUB") == 0)
                            published = true;
                    }
                    entries.add(new ArpEntry(ip, hwaddr, permanent, published,
                            ifname));
                }

                Collections.sort(entries);
            } catch (IOException e) {
                System.out.println("exception happened - here's what I know: ");
                e.printStackTrace();
            }
        }

        private ConfValue[] valsFromArpEntry(ArpEntry e) {
            Log.trace("==> valsFromArpEntry e=" + e);
            ConfValue[] retVal = new ConfValue[]{
                    e.getIPAddress(),
                    new ConfBuf(e.getIfName()),
                    new ConfBuf(e.getHWAddress()),
                    new ConfBool(e.getPermanent()),
                    new ConfBool(e.getPublished())
            };
            Log.trace("<== valsFromArpEntry");
            return retVal;
        }

        private ArpEntry getArpEntryByKeypath(ConfObject[] kp) {
            Log.trace("==> getArpEntryByKeypath");
            if (Log.isTraceEnabled()) {
                Log.trace("kp=" + (new ConfPath(kp)).toString());
            }
            ArpEntry retVal = null;
            int keyIndex = 1;
            if (kp[keyIndex] instanceof ConfTag) {
                Log.trace("remapping keyIndex from 1 to 0 (path for full " +
                        "object received from getObject)");
                keyIndex = 0;
            }
            String ip = ((ConfKey) kp[keyIndex]).elementAt(0).toString();
            String ifname = ((ConfKey) kp[keyIndex]).elementAt(1).toString();
            Log.trace("ip=" + ip + " ifname=" + ifname);

            for (int i = 0; i < entries.size(); i++) {
                ArpEntry e = (ArpEntry) entries.get(i);
                ConfIPv4 confIPv4 = null;
                try {
                    confIPv4 = new ConfIPv4(ip);
                } catch (ConfException ex) {
                    Log.error(ex);
                    break;
                }
                if ((e.getIPAddress().equals(confIPv4)) &&
                        (e.getIfName().equals(ifname))) {
                    Log.trace("Entry found!");
                    retVal = e;
                    break;
                }
            }
            if (retVal == null) {
                Log.trace("Entry not found!");
            }
            Log.trace("<== getArpEntryByKeypath retVal=" + retVal);
            return retVal;
        }

        /**
         * @see DpDataCallback
         */
        @DataCallback(callPoint = jdemo.callpoint_jarp_data,
                callType = DataCBType.ITERATOR)
        public Iterator<Object> iterator(DpTrans trans, ConfObject[] kp)
                throws DpCallbackException {
            Log.debug("==> iterator");
            populateEntries();
            Log.debug("<== iterator");
            return entries.iterator();
        }

        @DataCallback(callPoint = jdemo.callpoint_jarp_data,
                callType = DataCBType.GET_NEXT)
        public ConfKey getKey(DpTrans trans, ConfObject[] kp, Object obj)
                throws DpCallbackException {
            Log.debug("==> getKey");
            ArpEntry e = (ArpEntry) obj;
            ConfObject c;
            c = e.getIPAddress();
            ConfKey retVal = new ConfKey(new ConfObject[]{c,
                    new ConfBuf(e.getIfName())});
            Log.debug("<== getKey");
            return retVal;
        }

        @DataCallback(callPoint = jdemo.callpoint_jarp_data, callType =
                DataCBType.GET_NEXT_OBJECT)
        public ConfValue[] getIteratorObject(DpTrans trans, ConfObject[] kp,
                                             Object obj) throws
                DpCallbackException {
            Log.debug("==> getIteratorObject");
            ConfValue[] retVal = valsFromArpEntry((ArpEntry) obj);
            Log.debug("<== getIteratorObject");
            return retVal;
        }

        @DataCallback(callPoint = jdemo.callpoint_jarp_data, callType =
                DataCBType.GET_NEXT_OBJECT_LIST)
        public List<ConfValue[]>
        getIteratorObjectList(DpTrans trans,
                              ConfObject[] kp,
                              Object obj,
                              Iterator<? extends Object> iterator)
                throws DpCallbackException {
            Log.debug("==> getIteratorObject");

            // return MAX_ENTRIES, rest will be handled by next call
            final int MAX_ENTRIES = 10;

            NextObjectArrayList retVal;
            retVal = new NextObjectArrayList<ConfValue[]>();
            retVal.add(valsFromArpEntry((ArpEntry) obj));
            int i = 0;
            while (iterator.hasNext() && i < MAX_ENTRIES - 1) {
                retVal.add(valsFromArpEntry((ArpEntry) iterator.next()));
                i++;
            }

            Log.debug("<== getIteratorObject  etVal.size()=" + retVal.size());
            return retVal;
        }

        @DataCallback(callPoint = jdemo.callpoint_jarp_data, callType =
                DataCBType.GET_OBJECT)
        public ConfObject[] getObject(DpTrans trans, ConfObject[] kp)
                throws DpCallbackException {
            Log.debug("<== getObject");
            // entries map has to be updated
            // (for case we request specific row right after start,
            // e.g. show arp arpe 172.28.70.151 enp0s25)
            populateEntries();
            ConfObject[] retVal = null;
            ArpEntry e = getArpEntryByKeypath(kp);
            if (e != null) {
                retVal = valsFromArpEntry(e);
            }
            Log.debug("==> getObject");
            return retVal;
        }

        @DataCallback(callPoint = jdemo.callpoint_jarp_data,
                callType = {DataCBType.GET_ELEM})
        public ConfValue getElem(DpTrans trans, ConfObject[] kp) {
            Log.debug("==> getElem");
            // entries map has to be updated
            // (for case we request specific row right after start,
            // e.g. show arp arpe 172.28.70.151 enp0s25)
            populateEntries();
            ConfValue retVal = null;
            ArpEntry e = getArpEntryByKeypath(kp);
            if (e != null) {
                ConfTag leaf = (ConfTag) kp[0];
                switch (leaf.getTagHash()) {
                    case jdemo.jdemo_ip:
                        retVal = e.getIPAddress();
                        break;
                    case jdemo.jdemo_hwaddr:
                        retVal = new ConfBuf(e.getHWAddress());
                        break;
                    case jdemo.jdemo_permanent:
                        retVal = new ConfBool(e.getPermanent());
                        break;
                    case jdemo.jdemo_published:
                        retVal = new ConfBool(e.getPublished());
                        break;
                    default:
                        break;
                }
            }

            Log.debug("<== getElem");
            return retVal;
        }
    }


    public static class StatsTrans {

        @TransCallback(callType = {TransCBType.INIT})
        public void init(DpTrans trans) {
        }

        @TransCallback(callType = {TransCBType.FINISH})
        public void finish(DpTrans trans) {
        }

    }

    public static class TransValidateCb {

        public Maapi maapi;

        TransValidateCb(Maapi maapi) {
            this.maapi = maapi;
        }

        @TransValidateCallback(callType = {TransValidateCBType.INIT})
        public void init(DpTrans trans) throws DpCallbackException {
            // attach to the transaction
            try {
                int th = trans.getTransaction();
                jdemo jd = new jdemo();
                maapi.attach(th, jd.hash(), trans.getUserInfo().getUserId());
                maapi.setNamespace(th, jd.uri());
            } catch (Exception e) { // IOException, MaapiException
                throw new DpCallbackException("failed to attach via maapi: " +
                        e.getMessage());
            }
        }

        @TransValidateCallback(callType = {TransValidateCBType.STOP})
        public void stop(DpTrans trans) throws DpCallbackException {
            try {
                maapi.detach(trans.getTransaction());
            } catch (Exception e) { // IOException, MaapiException
                /* never mind */
            }
        }

    }


    /**
     * This is a simple validation point callback to
     * check the Port number of a Server
     **/

    public static class PortValpointCb {

        Maapi maapi;

        public PortValpointCb(Maapi maapi) {
            this.maapi = maapi;
        }


        /**
         * The  validate()  callback  should validate the values and
         * throw a DpCallbackException if the validation fails.
         * Theres also a possibility to throw a DpCallbackWarningException
         * with message set to a string describing the warning.
         * The  warnings  will  get propagated  to  the  transaction  engine,
         * and depending on where the transaction originates,
         * ConfD may or may not act on the warnings. If
         * the  transaction  originates  from the CLI or the Web UI, ConfD will
         * interactively present the user with a choice - whereby the  transac-
         * tion can be aborted.
         * <p>
         * If the transaction originates from NETCONF - which does not have any
         * interactive capabilities, the warnings are ignored. The warnings are
         * primarily intended to alert inexperienced users that attempt to make
         * - dangerous - configuration changes. There can be multiple  warnings
         * from multiple validation points in the same transaction.
         *
         * @param trans  The transaction
         * @param kp     The keypath
         * @param newval The new value to validate
         */

        @ValidateCallback(callPoint = jdemo.validate_validatePort,
                callType = {ValidateCBType.VALIDATE})

        public void validate(DpTrans trans, ConfObject[] kp,
                             ConfValue newval) throws DpCallbackException {

            ConfKey serverName = (ConfKey) kp[1];
            int th = trans.getTransaction();
            ConfKey next;
            ConfKey this_key = (ConfKey) kp[1];
            ConfUInt16 pVal = (ConfUInt16) newval;
            if (pVal.longValue() < 1025 || pVal.longValue() > 2048)
                throw new DpCallbackException("Port value not in range");
            try {
                MaapiCursor c = maapi.newCursor(th, "/servers/server");
                next = maapi.getNext(c);
                while (next != null) {
                    if (!next.equals(this_key)) {
                        // dont compare to our own value
                        ConfValue port = maapi.getElem(
                                th, "/servers/server{%x}/port", next);
                        if (port.equals(newval))
                            throw new DpCallbackException("port number: " +
                                    newval +
                                    " is already in use");
                    }
                    next = maapi.getNext(c);
                }
            } catch (Exception e) {
                e.printStackTrace();
                throw new DpCallbackException("failed to validate: " +
                        e.getMessage());
            }
        }
    }

    public static class IpValpointCb {

        Maapi maapi;

        public IpValpointCb(Maapi maapi) {
            this.maapi = maapi;
        }

        @ValidateCallback(callPoint = jdemo.validate_validateIp,
                callType = {ValidateCBType.VALIDATE})

        public void validate(DpTrans trans, ConfObject[] kp,
                             ConfValue newval) throws DpCallbackException {
            int[] addr = ((ConfIPv4) newval).getRawAddress();
            if (addr[0] == 192 && addr[1] == 168)
                throw new DpCallbackWarningException(
                        "local address in subnet 192.168/16");
            if (addr[0] == 10 && addr[1] == 0 && addr[2] == 0)
                throw new DpCallbackWarningException(
                        "local address in subnet 10.0.0/24");
        }
    }


}
