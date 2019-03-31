/*********************************************************************
 * ConfD Maapi example intro example, JAVA version
 *
 * (C) 2018 Tail-f Systems
 * Permission to use this code as a starting point hereby granted
 *
 * See the README file for more information
 ********************************************************************/

import com.tailf.conf.*;
import com.tailf.dp.*;
import com.tailf.dp.annotations.ActionCallback;
import com.tailf.dp.annotations.DataCallback;
import com.tailf.dp.annotations.TransValidateCallback;
import com.tailf.dp.annotations.ValidateCallback;
import com.tailf.dp.proto.ActionCBType;
import com.tailf.dp.proto.DataCBType;
import com.tailf.dp.proto.TransValidateCBType;
import com.tailf.dp.proto.ValidateCBType;
import com.tailf.maapi.*;
import org.apache.log4j.Logger;

import java.io.IOException;
import java.net.InetAddress;
import java.net.Socket;
import java.util.Arrays;
import java.util.Iterator;
import java.util.List;
import java.util.concurrent.SynchronousQueue;
import java.util.concurrent.TimeUnit;

public final class MaapiExample {
    private static final Logger log = Logger.getRootLogger();
    private static final String CONFD_HOST = "127.0.0.1";
    private static final String items_keypath_string = "/config/items";
    private static final String start_log_keypath_string = "/config/start-log";
    //we use default NETCONF timeout of 600s
    private static final int _DEFAULT_CONFIRMED_TIMEOUT = 600;

    public static class TransCbs {

        @TransValidateCallback(callType = {TransValidateCBType.INIT})
        public void init(DpTrans trans) {
            log.info("==> init");
            log.info("<== init");
        }

        @TransValidateCallback(callType = {TransValidateCBType.STOP})
        public void stop(DpTrans trans) {
            log.info("==> stop");
            log.info("<== stop");
        }
    }

    public static class ValCbs {
        Maapi maapi;

        public ValCbs(Maapi maapi) {
            this.maapi = maapi;
        }

        @ValidateCallback(callPoint = maapi_example.validate_val_items,
                callType = {ValidateCBType.VALIDATE})
        public void validate(DpTrans trans, ConfObject[] kp,
                             ConfValue newval) throws ConfException,
                IOException {

            log.info("==> validate kp=" + new ConfPath(kp));

            final long threshold = 100;
            final int tr = trans.getTransaction();
            long valSum = 0;

            maapi.attach(tr, maapi_example.hash);
            MaapiCursor cur = maapi.newCursor(tr, items_keypath_string);
            ConfKey key = maapi.getNext(cur);
            while (key != null) {
                if (maapi.exists(tr, items_keypath_string + key.toString() +
                        "/value")) {
                    log.trace("value element exists");
                    ConfUInt32 val = (ConfUInt32) maapi.getElem(tr,
                            items_keypath_string + key.toString() +
                                    "/value");
                    log.info("val=" + val);
                    valSum += val.longValue();
                }
                key = maapi.getNext(cur);
            }
            log.trace("valSum=" + valSum + " threshold=" + threshold);
            if (valSum > threshold) {
                String text = "Sum of value elements in " + items_keypath_string
                        + " is " + valSum + " which is greater than " +
                        threshold + "!";
                log.warn(text);
                throw new DpCallbackException(text);
            }

            maapi.detach(tr);

            log.info("<== validate");
        }

    }

    public static class DataCbs {
        Maapi maapi;

        public DataCbs(Maapi maapi) {
            this.maapi = maapi;
        }

        /**
         * Simple Java iterator wrapper around MaapiCursor
         */
        class MaapiCursorIterator implements Iterator<ConfKey> {

            MaapiCursor cursor = null;
            ConfKey currentKey = null;
            int tr = 0;

            public MaapiCursorIterator(int tr, String path) throws IOException,
                    ConfException {
                log.debug("==> ItemsIterator");
                this.tr = tr;
                maapi.attach(this.tr, maapi_example.hash);
                cursor = maapi.newCursor(tr, path);
                log.debug("<== ItemsIterator");
            }

            @Override
            public boolean hasNext() {
                log.trace("==> hasNext");
                boolean rv = false;
                log.trace("cursor=" + cursor + " currentkey=" + currentKey);
                if (cursor != null) {
                    if (currentKey == null) {
                        try {
                            currentKey = maapi.getNext(cursor);
                        } catch (IOException e) {
                            log.error(e);
                        } catch (ConfException e) {
                            log.error(e);
                        }
                    }
                    rv = (currentKey != null);
                }
                log.trace("<== hasNext rv=" + rv);
                return rv;
            }

            @Override
            public ConfKey next() {
                log.trace("==> next");
                ConfKey rv = currentKey;
                if (cursor != null) {
                    if (rv == null) {
                        try {
                            rv = maapi.getNext(cursor);
                        } catch (IOException e) {
                            log.error(e);
                        } catch (ConfException e) {
                            log.error(e);
                        }
                        if (rv == null) {
                            remove();
                        }
                    } else {
                        currentKey = null;
                    }
                }
                log.trace("<== next rv=" + rv);
                return rv;
            }

            @Override
            public void remove() {
                log.trace("==> remove");
                try {
                    maapi.detach(this.tr);
                } catch (IOException e) {
                    log.error(e);
                } catch (ConfException e) {
                    log.error(e);
                }
                log.trace("<== remove");
            }
        }

        /**
         * @see DpDataCallback
         */
        @DataCallback(callPoint = maapi_example.callpoint_items,
                callType = DataCBType.ITERATOR)
        public Iterator<Object> iterator(DpTrans trans, ConfObject[] kp)
                throws ConfException, IOException {
            log.trace("==> iterator");
            Iterator it = new MaapiCursorIterator(trans
                    .getTransaction(),
                    items_keypath_string);
            log.trace("<== iterator");
            return it;
        }

        @DataCallback(callPoint = maapi_example.callpoint_items,
                callType = DataCBType.GET_NEXT)
        public ConfKey getKey(DpTrans trans, ConfObject[] kp, Object obj) {
            log.trace("==> getKey kp=" + new ConfPath(kp));
            ConfKey rv = (ConfKey) obj;
            log.trace("<== getKey rv=" + rv);
            return rv;
        }


        @DataCallback(callPoint = maapi_example.callpoint_items,
                callType = DataCBType.GET_ELEM)
        public ConfValue getElem(DpTrans trans, ConfObject[] kp)
                throws ConfException, IOException {
            log.trace("==> getElem kp = " + new ConfPath(kp));
            ConfValue rv = null;
            int tr = trans.getTransaction();
            if (((ConfTag) kp[0]).getTag().equals(
                    maapi_example.maapi_example_value_)) {
                rv = maapi.getElem(tr, items_keypath_string +
                        kp[1].toString() + "/value");
            }

            log.trace("<== getElem rv=" + rv);
            return rv;
        }
    }

    public static class ClispecCbs {
        Maapi maapi;

        public ClispecCbs(Maapi maapi) {
            this.maapi = maapi;
        }

        /**
         * @see ActionCallback
         */
        @ActionCallback(callPoint = "start_count_cp", callType =
                ActionCBType.COMMAND)
        public String[] doStartCount(final DpActionTrans actx, String cmdname,
                                     String cmdpath, String[] params) throws
                ConfException, IOException {
            log.info("==> doStartCount cmdname=" + cmdname + " cmdpath="
                    + cmdpath + " params.length=" + params.length);
            String[] retVal = new String[]{};
            final int tr = actx.getTransaction();
            maapi.attach(tr, maapi_example.hash,
                    actx.getUserInfo().getUserId());

            int count = 0;
            MaapiCursor cur = maapi.newCursor(tr, start_log_keypath_string);
            ConfKey key = maapi.getNext(cur);
            while (key != null) {
                if (maapi.exists(tr, start_log_keypath_string + key)) {
                    count++;
                }
                log.trace("Value element count=" + count);
                key = maapi.getNext(cur);
            }
            log.trace("count=" + count);
            maapi.detach(tr);
            maapi.getCLIInteraction(actx.getUserInfo().getUserId()).write(
                    "\nApplication startup count " + count + "\n"
            );

            log.info("<== doStartCount");
            return retVal;
        }

        class XpathEvalIterUsid implements MaapiXPathEvalResult {

            @Override
            public XPathNodeIterateResultFlag result(ConfObject[] confObjects,
                                                     ConfValue confValue,
                                                     Object usid) {
                log.trace("==> result");
                XPathNodeIterateResultFlag rv =
                        XPathNodeIterateResultFlag.ITER_CONTINUE;
                try {
                    maapi.getCLIInteraction((Integer) usid).write(
                            "Item " + confValue.toString() + "\n");
                } catch (IOException e) {
                    e.printStackTrace();
                } catch (ConfException e) {
                    e.printStackTrace();
                }
                log.trace("<== result rv=" + rv);
                return rv;
            }
        }

        @ActionCallback(callPoint = "show_items_with_value_cp", callType =
                ActionCBType.COMMAND)
        public String[] doShowItems(final DpActionTrans actx, String cmdname,
                                    String cmdpath, String[] params) throws
                ConfException, IOException {
            log.info("==> doShowItems cmdname=" + cmdname + " cmdpath=" +
                    cmdpath + " params.length=" + params.length);
            String[] retVal = new String[]{};

            if (params.length != 1) {
                String text = "Wrong number of arguments " + params.length +
                        ", expected 2"; //+1 for cmdname
                log.fatal(text);
                throw new DpCallbackException(text);
            }
            log.debug("value to search for is argv[1]=" + params[0]);
            final int tr = actx.getTransaction();
            maapi.attach(tr, maapi_example.hash,
                    actx.getUserInfo().getUserId());
            String qstr = items_keypath_string + "[value = " + params[0] +
                    "]/name";
            log.trace("qstr=" + qstr);
            maapi.xpathEval(tr, new XpathEvalIterUsid(), null, qstr,
                    actx.getUserInfo().getUserId(), null);
            maapi.detach(tr);

            log.info("<== doShowItems");
            return retVal;
        }

        @ActionCallback(callPoint = "show_items_with_smaller_than_value_cp",
                callType = ActionCBType.COMMAND)
        public String[] doShowItemsSmallerThan(final DpActionTrans actx, String
                cmdname, String cmdpath, String[] params) throws
                ConfException, IOException {
            log.info("==> doShowItemsSmallerThan cmdname=" + cmdname + " " +
                    "cmdpath=" + cmdpath + " params.length=" + params.length);
            String[] retVal = new String[]{};

            if (params.length != 1) {
                String text = "Wrong number of arguments " + params.length +
                        ", expected 2"; //+1 for cmdname
                log.fatal(text);
                throw new DpCallbackException(text);
            }
            log.debug("value to search for is argv[1]=" + params[0]);
            final int tr = actx.getTransaction();
            maapi.attach(tr, maapi_example.hash,
                    actx.getUserInfo().getUserId());
            String qstr = items_keypath_string + "[value < " + params[0] + "]";
            log.trace("qstr=" + qstr);
            QueryResult res = maapi.queryStart(tr, qstr, null, 0, 1,
                    Arrays.asList(new String[]{"name"}),
                    ResultTypeTag.class);
            log.trace("res.resultCount()" + res.resultCount());
            Iterator it = res.iterator();
            QueryResult.Entry en = (QueryResult.Entry) it.next();
            while (en != null) {
                List<ResultTypeTag> vals = en.value();
                for (ResultTypeTag resVal : vals) {
                    log.trace("tag=" + resVal.tag().getTag() + " val=" +
                            resVal.tag().getValue().toString());
                    maapi.getCLIInteraction(actx.getUserInfo().getUserId())
                            .write("Item " + resVal.tag().getValue()
                                    .toString() + "\n");
                }
                en = (QueryResult.Entry) it.next();
            }
            maapi.detach(tr);

            log.info("<== doShowItemsSmallerThan");
            return retVal;
        }
    }

    public static class ClispecCommitCbs {
        Maapi maapiCommit;

        public ClispecCommitCbs(Maapi maapiCommit) {
            this.maapiCommit = maapiCommit;
        }

        private int timeoutToInt(String timeout) {
            log.trace("==> timeoutToInt timeout=" + timeout);
            int rv = _DEFAULT_CONFIRMED_TIMEOUT;
            if (timeout != null) {
                rv = Integer.parseInt(timeout);
            }
            log.trace("<== timeoutToInt rv=" + rv);
            return rv;
        }

        /**
         * Start confirmed commit.
         *
         * @param usid    session id for maapi_cli_write
         * @param id      persist id for the commit or null
         * @param timeout timeout for the commit (default is used when null)
         * @throws IOException,ConfException
         */
        private void performMaapiCandidateConfirmedCommit(final int usid,
                                                          final String id,
                                                          final String timeout)
                throws IOException, ConfException {
            log.info("==> performMaapiCandidateConfirmedCommit usid=" + usid
                    + " id=" + id + " timeout=" + timeout);

            maapiCommit.candidateConfirmedCommitPersistent(timeoutToInt
                    (timeout), id, null);
            maapiCommit.getCLIInteraction(usid).write("Confirmed commit " +
                    "started!\n");
            if (id != null) {
                maapiCommit.getCLIInteraction(usid).write("Persist: " + id +
                        "\n");
            }
            if (timeout != null) {
                maapiCommit.getCLIInteraction(usid).write("Timeout: " +
                        timeout + "\n");
            }

            log.info("<== performMaapiCandidateConfirmedCommit");
        }

        /**
         * Print to CLI status info if there is ongoing confirmed commit.
         * NOTE: maapi_confirmed_commit_in_progress return usid of ongoing
         * commit (ConfD User Guide says 1)
         *
         * @param usid session id for maapi_cli_write
         * @throws IOException,ConfException
         */
        private void performMaapiCommitStatus(final int usid) throws
                IOException, ConfException {
            log.info("==> performMaapiCommitStatus usid=" + usid);

            int stat = maapiCommit.confirmedCommitInProgress();
            log.trace("stat=" + stat);
            if (stat != 0) {
                maapiCommit.getCLIInteraction(usid).write("Ongoing commit in " +
                        "progress!\n");
                maapiCommit.getCLIInteraction(usid).write("Session id:" +
                        stat + "\n");
            } else {
                maapiCommit.getCLIInteraction(usid).write("No ongoing commit " +
                        "in progress!\n");
            }

            log.info("<== performMaapiCommitStatus");
        }

        /**
         * Abort ongoig commit operation
         *
         * @param usid session id for maapi_cli_write
         * @param id   persist id for the commit or null
         * @throws IOException,ConfException
         */
        private void performMaapiCommitAbort(final int usid, final String id)
                throws IOException, ConfException {
            log.info("==> performMaapiCommitAbort usid=" + usid + " id=" + id);

            try {
                maapiCommit.candidateAbortCommitPersistent(id);
                maapiCommit.getCLIInteraction(usid).write("Confirmed commit " +
                        "aborted!\n");
                if (id != null) {
                    maapiCommit.getCLIInteraction(usid).write("Persist id: "
                            + id + "\n");
                }
            } catch (ConfException e) {
                maapiCommit.getCLIInteraction(usid).write("Commit not " +
                        "aborted! (Is persist id correct?)\n");
                String text = "Failed to abort commit! usid=" + usid + " id="
                        + id;
                log.warn(text, e);
                throw e;
            }

            log.info("<== performMaapiCommitAbort");
        }

        /**
         * Copy candidate to running.
         * Optionally use persist id of ongoing commit operation.
         *
         * @param usid session id for maapi_cli_write
         * @param id   persist id for the commit or null
         * @throws IOException,ConfException
         */
        private void confirmMaapiCandidateCommit(final int usid,
                                                 final String id) throws
                IOException, ConfException {
            log.info("==> confirmMaapiCandidateCommit usid=" + usid + " id="
                    + id);

            try {
                maapiCommit.candidateCommitPersistent(id);
                maapiCommit.getCLIInteraction(usid).write("Commit " +
                        "successfully confirmed!\n");
                if (id != null) {
                    maapiCommit.getCLIInteraction(usid).write("Persist id: "
                            + id + "\n");
                }
            } catch (ConfException e) {
                maapiCommit.getCLIInteraction(usid).write("Commit not " +
                        "confirmed! (Is persist id correct?)\n");
                String text = "Failed to confirm commit! usid=" + usid + " id="
                        + id;
                log.warn(text, e);
                throw e;
            }

            log.info("<== performMaapiCandidateConfirmedCommit");
        }

        @ActionCallback(callPoint = "start_confirmed_commit", callType =
                ActionCBType.COMMAND)
        public String[] doConfirmedCommit(final DpActionTrans actx, String
                cmdname, String cmdpath, String[] params) throws
                ConfException, IOException {
            log.info("==> doConfirmedCommit");
            String[] retVal = new String[]{};
            log.trace("params.length=" + params.length);
            if (params.length != 4 && (params.length > 2)) {
                String text = "Wrong number of arguments " + params.length +
                        ", expected 1,2,3,5"; //+1 for cmdname
                log.fatal(text);
                throw new DpCallbackException(text);
            }
            final int tr = actx.getTransaction();
            final int usid = actx.getUserInfo().getUserId();
            maapiCommit.attach(tr, maapi_example.hash, usid);
            switch (params.length) {
                case 0:
                    performMaapiCandidateConfirmedCommit(usid, null, null);
                    break;
                case 1:
                    if (params[0].equals("status")) {
                        performMaapiCommitStatus(usid);
                    } else if (params[0].equals("abort")) {
                        // abort ongoing confirmed commit - without ID
                        performMaapiCommitAbort(usid, null);
                    } else if (params[0].equals("confirm")) {
                        // confirm ongoing confirmed commit - without ID
                        confirmMaapiCandidateCommit(usid, null);
                    } else {
                        String text = "Unexpected parameter argv[1]=" +
                                params[0];
                        log.fatal(text);
                        throw new DpCallbackException(text);
                    }
                    break;
                case 2:
                    if (params[0].equals("abort")) {
                        // abort ongoing confirmed commit - with ID
                        performMaapiCommitAbort(usid, params[1]);
                    } else if (params[0].equals("confirm")) {
                        // confirm ongoing confirmed commit - with ID
                        confirmMaapiCandidateCommit(usid, params[1]);
                    } else if (params[0].equals("timeout")) {
                        // start new commit without id and with timeout
                        performMaapiCandidateConfirmedCommit(usid, null,
                                params[1]);
                    } else if (params[0].equals("persist")) {
                        // start new commit with id and without timeout
                        performMaapiCandidateConfirmedCommit(usid, params[1],
                                null);
                    } else {
                        String text = "Unexpected parameter argv[1]=" +
                                params[0];
                        log.fatal(text);
                        throw new DpCallbackException(text);
                    }
                    break;
                case 4:
                    // start new commit with id and timeout
                    performMaapiCandidateConfirmedCommit(usid, params[1],
                            params[3]);
                    break;
                default:
                    String text = "Not supported params.length=" + params
                            .length;
                    log.fatal(text);
                    throw new DpCallbackException(text);
            }
            maapiCommit.detach(tr);

            log.info("<== doConfirmedCommit");
            return retVal;
        }
    }

    private static void updateStartLog(Maapi maapi) throws IOException,
            ConfException {
        log.info("==> updateStartLog");
        log.debug("Creating start-log record");
        String user = "admin";
        String[] groups = new String[]{"admin"};
        String context = "maapiCommit";
        maapi.startUserSession(user, InetAddress.getByName(CONFD_HOST),
                context, groups, MaapiUserSessionFlag.PROTO_TCP);
        int tr = maapi.startTrans(Conf.DB_CANDIDATE, Conf.MODE_READ_WRITE);
        ConfDatetime dt = ConfDatetime.getConfDatetime();
        log.trace("logging timestamp " + dt);
        maapi.create(tr, start_log_keypath_string + "{" + dt + "}");
        maapi.applyTrans(tr, false);
        maapi.finishTrans(tr);
        maapi.candidateCommit();

        log.info("<== updateStartLog");
    }

    public static int createDaemon() {
        log.info("==> createDaemon");
        int daemonRetVal = Conf.REPLY_OK;

        try {

            Maapi maapi = new Maapi(new Socket(CONFD_HOST, Conf.PORT));
            Maapi maapiCommit = new Maapi(new Socket(CONFD_HOST, Conf.PORT));
            // init and connect control socket
            Socket ctrlSocket = new Socket(CONFD_HOST, Conf.PORT);
            // we need 2 threads as commit action callback invokes validation
            final int NUM_CONFD_THREADS = 2;

            final Dp dp = new Dp("maapi_example", ctrlSocket, false,
                    NUM_CONFD_THREADS,
                    NUM_CONFD_THREADS,
                    60L, TimeUnit.SECONDS, new SynchronousQueue(), true);

            dp.registerAnnotatedCallbacks(new TransCbs());
            dp.registerAnnotatedCallbacks(new ValCbs(maapi));
            dp.registerAnnotatedCallbacks(new DataCbs(maapi));
            dp.registerAnnotatedCallbacks(new ClispecCbs(maapi));
            dp.registerAnnotatedCallbacks(new ClispecCommitCbs(maapiCommit));
            dp.registerDone();

            updateStartLog(maapi);

            log.info("Maapi example Started");
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
