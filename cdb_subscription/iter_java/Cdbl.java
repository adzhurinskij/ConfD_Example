
import java.io.IOException;
import java.net.Socket;
import java.util.EnumSet;

import org.apache.log4j.Logger;

import com.tailf.cdb.Cdb;
import com.tailf.cdb.CdbDBType;
import com.tailf.cdb.CdbDiffIterate;
import com.tailf.cdb.CdbSession;
import com.tailf.cdb.CdbSubscription;
import com.tailf.cdb.CdbSubscriptionSyncType;
import com.tailf.cdb.CdbSubscriptionType;
import com.tailf.conf.Conf;
import com.tailf.conf.ConfBuf;
import com.tailf.conf.ConfInt64;
import com.tailf.conf.ConfKey;
import com.tailf.conf.ConfObject;
import com.tailf.conf.ConfPath;
import com.tailf.conf.ConfTag;
import com.tailf.conf.ConfValue;
import com.tailf.conf.DiffIterateFlags;
import com.tailf.conf.DiffIterateOperFlag;
import com.tailf.conf.DiffIterateResultFlag;

public class Cdbl {
    private static Logger log = Logger.getLogger(Cdbl.class);

    private static String confdAddress = "127.0.0.1";
    private static int confdPort = Conf.PORT;
    private static int headPoint;
    public final static int MAXH = 3;
    public final static int MAXC = 2;
    public static RFHead[] rfheads = new RFHead[MAXH];

    protected static class RFHead {
        protected ConfInt64 dn;
        protected ConfBuf sector_id;
        protected boolean inuse;
        protected Child[] children = new Child[Cdbl.MAXC];

        public RFHead() {
            for ( int i = 0; i < Cdbl.MAXC; i++ ) children[i] = new Child();
        }
    }

    protected static class Child {
        protected ConfInt64 dn;
        protected String childattr;
        protected boolean inuse;
    }


    public static void main(String arg[]) {
        if (arg.length > 0) {
            try {
                confdPort = Integer.parseInt(arg[1]);
            } catch (NumberFormatException e) {
                confdPort = Conf.PORT;
            }
        }

        Socket sock = null;
        try {
            sock = new Socket(confdAddress, confdPort);
        } catch ( IOException e ) {
            log.error("Could not open SocketChannel ");
            e.printStackTrace();
            System.exit(1);
        }


        Cdb cdb = null;
        Cdb cdb2 = null;
        CdbSubscription cdbSubscriber = null;
        try {
            cdb = new Cdb("Subscription-Sock",  sock);
            cdbSubscriber = cdb.newSubscription();
            headPoint =
                cdbSubscriber.subscribe(CdbSubscriptionType.SUB_RUNNING,
                                        3, root.hash, "/root/NodeB/RFHead");
            cdbSubscriber.subscribeDone();
            cdb2 = new Cdb(Cdbl.class.getName(), new Socket("127.0.0.1",
                                                            confdPort));
        } catch (Exception e) {
            log.error( "Could not connect to cdb", e);
            System.exit(1);
        }

        readDb(cdb2) ;
        dumpDb();

        try {
            while (true) {
                try {
                    int[] point = cdbSubscriber.read();
                    CdbSession cdbSession =
                        cdb2.startSession(CdbDBType.CDB_RUNNING);
                    EnumSet<DiffIterateFlags> diffFlags =
                            EnumSet.of(DiffIterateFlags.ITER_WANT_PREV);
                    cdbSubscriber.diffIterate(point[0], new DiffIterateImpl(),
                                              diffFlags, cdbSession);
                    cdbSession.endSession();
                } finally {
                    cdbSubscriber.sync(CdbSubscriptionSyncType.DONE_PRIORITY);
                    dumpDb ();
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
            System.exit(1);
        }
    }

    private static void dumpDb() {
        System.err.printf("\nDumping \n");
        for (int i = 0; i < MAXH; i++) {
            if (!Cdbl.rfheads[i].inuse) {
                continue;
            }
            System.err.printf("HEAD %d <%s>\n", rfheads[i].dn.longValue(),
                              rfheads[i].sector_id);
            for (int j = 0; j < Cdbl.MAXC; j++) {
                if (!Cdbl.rfheads[i].children[j].inuse) {
                    continue;
                }
                System.err.printf("    Child %d <<%s>> \n",
                                  Cdbl.rfheads[i].children[j].dn.longValue(),
                                  Cdbl.rfheads[i].children[j]
                                  .childattr.toString());
            }
        }

        System.err.printf(  "---------- \n");
    }

    static void readDb(Cdb cdb) {
        CdbSession cdbSession = null;
        try {
            cdbSession = cdb.startSession(CdbDBType.CDB_RUNNING);
            cdbSession.setNamespace(new root());
        } catch (Exception e) {
            log.error("Could not start new session ", e);
            return;
        }

        try {
            int n = cdbSession.getNumberOfInstances(
                                          new ConfPath("/root/NodeB/RFHead"));
            for (int i = 0; i < Cdbl.MAXH ; i++) {
                rfheads[i] = new RFHead();
            }

            for (int i = 0; i < n; i++) {
                ConfValue key =
                    cdbSession.getElem ( "/root/NodeB/RFHead[%d]/dn", i);
                readHead (cdbSession, new ConfKey(key));
            }
            cdbSession.endSession();
        } catch (Exception e) {
            e.printStackTrace();
            return;
        }
    }

    static void readHead(CdbSession cdbSession, ConfKey key) {
        int i = 0;
        int pos = -1;

        for (i = 0; i < Cdbl.MAXH; i++) {
            if (key.equals(new ConfKey(Cdbl.rfheads[i].dn))) {
                pos = i;
                break;
            }
        }

        if (pos == -1) {
            for (i = 0; i < MAXH; i++) {
                if (!rfheads[i].inuse) {
                    pos = i;
                    break;
                }
            }
        }
        System.err.printf("Picking %d \n" , pos) ;
        Cdbl.RFHead hp = Cdbl.rfheads[pos];

        try {
            cdbSession.cd("/root/NodeB/RFHead{%x}", key);
            hp.dn = (ConfInt64)cdbSession.getElem(new ConfPath("dn"));
            hp.sector_id =
                (ConfBuf) cdbSession.getElem( new ConfPath ("SECTORID_ID"));
            hp.inuse = true;
            int n = cdbSession.getNumberOfInstances("Child") ;

            for (i =0; i < n; i++) {
                hp.children[i].dn =
                    (ConfInt64) cdbSession.getElem("Child[%d]/cdn",i);
                hp.children[i].childattr =
                    ((ConfBuf) cdbSession.getElem("Child[%d]/childAttr",i)).
                                                                    toString();
                hp.children[i].inuse = true;
            }
        } catch (Exception e) {
            log.error(" Could not read values ", e);
        }
    }
}


class DiffIterateImpl implements CdbDiffIterate {
    private static Logger log = Logger.getLogger(DiffIterateImpl.class);
        public DiffIterateResultFlag iterate(ConfObject[] kp,
                                             DiffIterateOperFlag op,
                                             ConfObject oldValue,
                                             ConfObject newValue,
                                             Object initstate) {
            CdbSession cdbSession = (CdbSession) initstate;
            ConfPath path = new ConfPath(kp);
            switch (op) {
            case MOP_CREATED: {
                System.err.printf("Create: %s\n", path.toString());
                ConfTag tag = (ConfTag) kp[1];
                switch (tag.getTagHash()) {
                case root.root_RFHead: {
                    /* an rfhead was created */
                    /* keypath is /root/NodeB/RFHead{$key}  */
                    /*              3     2      1    0     */
                    /*       /ConfTag/ConfTag/ConfTag/ConfKey */
                    Cdbl.readHead(cdbSession, (ConfKey)kp[0]);
                    return DiffIterateResultFlag.ITER_CONTINUE;
                }
                case root.root_Child: {
                    /* a child to en existing rfhead was created */
                    /* keypath is /root/NodeB/RFHead{$key}/Child{$key2}  */
                    /*              5      4      3    2      1    0     */
                    /* we can here choose to read the  new child or reread */
                    /* the entire head structure       */
                    Cdbl.readHead(cdbSession, (ConfKey)kp[2]);
                    return DiffIterateResultFlag.ITER_CONTINUE;
                }
                }
            }
            case MOP_DELETED: {
                System.err.printf("Create: %s\n", path.toString());
                ConfTag tag = (ConfTag) kp[1];
                switch (tag.getTagHash()) {
                case root.root_RFHead: {/* an rfhead was deleted */
                    /* keypath is /root/NodeB/RFHead{$key}  */
                    /*              3     2      1    0     */
                    /*           /ConfTag/ConfTag/ConfTag/ConfKey */
                    ConfKey headkey = (ConfKey)kp[0];
                    int headpos = 0;
                    while (headpos < Cdbl.MAXH) {
                        Cdbl.RFHead hp = Cdbl.rfheads[headpos++];
                        if (hp.inuse && new ConfKey(hp.dn).equals(headkey)) {
                            for (int i = 0; i < Cdbl.MAXC; i++) {
                                hp.children[i].inuse = false;
                            }
                            hp.inuse = false;
                            return DiffIterateResultFlag.ITER_CONTINUE;
                        }
                    }
                    break;
                }
                case root.root_Child: {
                    /* a child of an existing head was removed */
                    /* keypath is /root/NodeB/RFHead{$key}/Child{$key2}  */
                    /*              5      4      3    2      1    0     */
                    /* we can here choose to read the  new child or reread */
                    /* the entire head structure                           */
                    ConfKey headkey = (ConfKey)kp[2];
                    ConfKey childkey = (ConfKey)kp[0];
                    /* Now given the key here, identifying an rfhead */
                    /* we find the rfhead which contains our child */
                    int headpos = 0;

                    while (headpos < Cdbl.MAXH) {
                        Cdbl.RFHead hp = Cdbl.rfheads[headpos++];
                        log.info("hp.dn:" + hp.dn);
                        log.info("headkey:" + headkey);
                        if (new ConfKey(hp.dn).equals(headkey)) {
                            int cpos = 0;
                            log.info(" inside hp.dn :" +hp.dn );
                            while (cpos < Cdbl.MAXC) {
                                log.info(" child cpos:" + cpos);
                                Cdbl.Child cp = hp.children[cpos++];
                                log.info(" child cp.dn:" + cp.dn);
                                log.info(" childkey:" + childkey);

                                if (childkey.equals(new ConfKey(cp.dn))) {
                                    log.info(" equals!");
                                    cp.inuse = false;
                                    return DiffIterateResultFlag.ITER_CONTINUE;
                                }
                            }
                        }
                    }
                }
                }
            }
            case MOP_MODIFIED: {
                System.err.printf( "Modified %s\n", path.toString());
                break;
            }
            case MOP_VALUE_SET: {
                System.err.printf("Value Set %s --> %s \n",
                                  path.toString(), newValue);
                ConfTag tag = (ConfTag) kp[0];
                switch (tag.getTagHash()) {
                case root.root_SECTORID_ID: {
                    /* keypath is /root/NodeB/RFHead{$key}/SECTORID_ID  */
                    /*              4     3      2     1       0        */
                        ConfKey headkey = (ConfKey) kp[1];
                        int headpos = 0;

                        while (headpos < Cdbl.MAXH) {
                            Cdbl.RFHead hp = Cdbl.rfheads[headpos++];
                            if (headkey.equals(new ConfKey(hp.dn))) {
                                hp.sector_id  = (ConfBuf) newValue;
                                return DiffIterateResultFlag.ITER_RECURSE;
                            }
                        }
                    }
                    break;
                    case root.root_childAttr: {
          /* keypath is /root/NodeB/RFHead{$key}/Child{$key2}/childAttr  */
          /*              6      5      4    3      2     1       0      */
                        ConfKey headkey = (ConfKey) kp[3];
                        ConfKey childkey = (ConfKey) kp[1];
                        int headpos = 0;
                        while (headpos < Cdbl.MAXH) {
                            Cdbl.RFHead hp = Cdbl.rfheads[headpos++];
                            if (new ConfKey(hp.dn).equals(headkey)) {
                                int cpos = 0;
                                while (cpos < Cdbl.MAXC) {
                                    Cdbl.Child cp = hp.children[cpos++];
                                    if (new ConfKey(cp.dn).equals(childkey)) {
                                        cp.childattr = newValue.toString();
                                        return
                                            DiffIterateResultFlag.ITER_CONTINUE;
                                    }
                                }
                            }
                        }
                    }
                    }
                break;
            }
            default:
                System.err.printf("Unexpected op %d for %s\n", op,
                                  path.toString());
            }
            return DiffIterateResultFlag.ITER_RECURSE;
        }
}


