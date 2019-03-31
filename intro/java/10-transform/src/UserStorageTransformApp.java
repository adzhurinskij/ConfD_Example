/*********************************************************************
 * ConfD Transform intro example, JAVA version
 *
 * (C) 2018 Tail-f Systems
 * Permission to use this code as a starting point hereby granted
 *
 * See the README file for more information
 ********************************************************************/

import com.tailf.conf.*;
import com.tailf.dp.Dp;
import com.tailf.dp.DpTrans;
import com.tailf.dp.annotations.DataCallback;
import com.tailf.dp.annotations.DpFlags;
import com.tailf.dp.annotations.TransCallback;
import com.tailf.dp.proto.DataCBType;
import com.tailf.dp.proto.TransCBType;
import com.tailf.maapi.Maapi;
import com.tailf.maapi.MaapiCursor;
import com.tailf.maapi.MaapiXPathEvalResult;
import com.tailf.maapi.XPathNodeIterateResultFlag;
import org.apache.log4j.Logger;

import java.io.IOException;
import java.net.ConnectException;
import java.net.Socket;
import java.util.Iterator;

public class UserStorageTransformApp {
    private static final String CONFD_HOST = "127.0.0.1";
    private static Logger log = Logger.getLogger(UserStorageTransformApp.class);
    private static String USER_PATH = "/user-storage/user";
    private static String STORAGE_PATH = "/user-storage/storage";
    private static String OWNER_PATH = "/user-storage/ownership";
    private static String STORAGE_ID_SEPARATOR = "||";
    private static String MOUNTPOINT_PREFIX = "/mnt/user-storages";
    private static int INIT_USER_ID = 100;

    public static class TransCbs {

        private Maapi maapi;

        public TransCbs(Maapi maapi) {
            this.maapi = maapi;
        }

        @TransCallback(callType = {TransCBType.INIT})
        public void init(DpTrans trans) throws IOException, ConfException {
            log.info("==> init");
            maapi.attach(trans.getTransaction(), userStorage.hash);
            log.info("<== init");
        }

        @TransCallback(callType = {TransCBType.FINISH})
        public void stop(DpTrans trans) throws IOException, ConfException {
            log.info("==> stop");
            maapi.detach(trans.getTransaction());
            log.info("<== stop");
        }
    }

    @DpFlags(leafListAsLeaf = true)
    protected static class TransformDataCbs {
        private Maapi maapi;

        public TransformDataCbs(Maapi maapi) {
            this.maapi = maapi;
        }

        class XpathEvalIterUserId implements MaapiXPathEvalResult {
            Integer userId = null;

            @Override
            public XPathNodeIterateResultFlag result(ConfObject[] kp,
                                                     ConfValue val,
                                                     Object tr) {
                log.debug("==> result kp=" + new ConfPath(kp) + " val=" + val);
                XPathNodeIterateResultFlag rv =
                        XPathNodeIterateResultFlag.ITER_STOP;
                userId = ((ConfInt32) val).intValue();

                log.debug("<== result rv=" + rv);
                return rv;
            }

            Integer getUserId() {
                log.trace("==> getUserId");
                Integer rv = userId;
                log.trace("<== getUserId rv=" + rv);
                return rv;
            }
        }

        private ConfInt32 getUserIdByUserName(int tr, ConfValue username) throws
                IOException, ConfException {
            log.debug("==> getUserIdByUserName");

            ConfInt32 rv = null;
            String xpathExpr = USER_PATH + "[username=\"" + username +
                    "\"]/user-id";
            XpathEvalIterUserId xpathIter = new XpathEvalIterUserId();
            maapi.xpathEval(tr, xpathIter, null, xpathExpr,
                    null, null);
            Integer userId = xpathIter.getUserId();
            if (userId != null) {
                rv = new ConfInt32(userId);
            }

            log.debug("<== getUserIdByUserName rv=" + rv);
            return rv;

        }

        private ConfEnumeration getLLAuthType(int tr, int userId) throws
                IOException, ConfException {
            log.debug("==> getLLAuthType userId=" + userId);
            ConfEnumeration rv = (ConfEnumeration) maapi.getElem(tr,
                    USER_PATH + "{" + userId + "}/auth-info/auth-type");
            log.debug("<== getLLAuthType rv=" + rv);
            return rv;
        }

        private ConfList getFolderContentType(int tr, int userId,
                                              ConfValue storageId) throws
                IOException, ConfException {
            log.debug("==> getFolderContentType usrId=" + userId +
                    " storageId=" + storageId);

            ConfList rv = null;
            ConfBit32 content = null;
            String contentPath = OWNER_PATH + "{" + userId + " " + storageId +
                    "}/content-type";

            if (maapi.exists(tr, contentPath)) {
                content = (ConfBit32) maapi.getElem(tr, contentPath);
            }
            log.trace("content=" + content);
            if (content != null) {
                rv = new ConfList();
                if ((content.intValue() & userStorage.storage__bm_t3_media)
                        != 0) {
                    rv.addElem(new ConfEnumeration(userFolders.folders_media));
                }
                if ((content.intValue() & userStorage
                        .storage__bm_t3_document) != 0) {
                    rv.addElem(new ConfEnumeration(userFolders
                            .folders_document));
                }
                if ((content.intValue() & userStorage.storage__bm_t3_archive) !=
                        0) {
                    rv.addElem(
                            new ConfEnumeration(userFolders.folders_archive));
                }
            }

            log.debug("<== getFolderContentType rv=" + rv);
            return rv;
        }

        private ConfBit32 contentTypeLeafListToBitmask(ConfList list) throws
                ConfException {
            log.debug("==> contentTypeLeafListToBitmask list=" + list);
            long bits = 0;
            ConfObject[] elements = list.elements();
            for (ConfObject elem : elements) {
                ConfEnumeration en = (ConfEnumeration) elem;
                switch (en.getOrdinalValue()) {
                    case userFolders.folders_media:
                        bits |= userStorage.storage__bm_t3_media;
                        break;
                    case userFolders.folders_document:
                        bits |= userStorage.storage__bm_t3_document;
                        break;
                    case userFolders.folders_archive:
                        bits |= userStorage.storage__bm_t3_archive;
                        break;
                    default:
                        String text = "Incorrect enumeration value. en" +
                                ".getOrdinalValue()=" + en.getOrdinalValue();
                        log.error(text);
                        throw new ConfException(text);
                }
            }
            log.trace("bits=" + bits);
            ConfBit32 rv = new ConfBit32(bits);
            log.debug("<== contentTypeLeafListToBitmask rv=" + rv);
            return rv;
        }

        private ConfBuf getLLStorageId(int tr, ConfValue username, ConfValue
                folderId) throws
                IOException, ConfException {
            log.debug("==> getLLStorageId");
            ConfBuf rv = null;
            ConfInt32 userId = getUserIdByUserName(tr, username);
            if (userId != null) {
                rv = new ConfBuf(userId + STORAGE_ID_SEPARATOR + folderId);
            }

            log.debug("<== getLLStorageId rv=" + rv);
            return rv;
        }

        int getUnusedUserId(int tr) throws IOException, ConfException {
            log.debug("==> getUnusedUserId");
            int rv = INIT_USER_ID;
            MaapiCursor cursor = maapi.newCursor(tr, USER_PATH);

            ConfKey val = maapi.getNext(cursor);
            while (val != null) {
                rv = ((ConfInt32) (val.elements()[0])).intValue();
                val = maapi.getNext(cursor);
            }
            rv++;
            log.debug("<== getUnusedUserId rv=" + rv);
            return rv;
        }

        /**
         * Java iterator wrapper around MaapiCursor
         */
        abstract class MaapiCursorIterator implements Iterator<ConfKey> {

            MaapiCursor cursor;
            ConfKey currentKey = null;
            int tr;

            public MaapiCursorIterator(int tr, String path) throws
                    IOException,
                    ConfException {
                log.debug("==> MaapiCursorIterator path=" + path);
                this.tr = tr;
                this.cursor = maapi.newCursor(tr, path);
                log.debug("<== MaapiCursorIterator");
            }

            protected abstract ConfKey getNext();

            @Override
            public boolean hasNext() {
                log.debug("==> hasNext");

                if (currentKey == null) {
                    currentKey = getNext();
                }
                boolean rv = (currentKey != null);

                log.debug("<== hasNext rv=" + rv);
                return rv;
            }

            @Override
            public ConfKey next() {
                log.debug("==> next");

                if (currentKey == null) {
                    currentKey = getNext();
                    if (currentKey == null) {
                        remove();
                    }
                }
                ConfKey rv = currentKey;
                currentKey = null;

                log.debug("<== next rv=" + rv);
                return rv;
            }

            @Override
            public void remove() {
                log.debug("==> remove");
                log.debug("<== remove");
            }
        }

        class UserIterator extends MaapiCursorIterator {

            public UserIterator(int tr) throws IOException,
                    ConfException {
                super(tr, USER_PATH);
            }

            protected ConfKey getNext() {
                log.debug("==> getNext");
                ConfKey rv = null;
                if (cursor != null) {
                    try {
                        ConfKey lowKey = maapi.getNext(cursor);
                        if (lowKey != null) {
                            rv = new ConfKey(maapi.getElem(tr, USER_PATH +
                                    lowKey.toString() + "/username"));
                        }
                    } catch (IOException e) {
                        log.error(e);
                    } catch (ConfException e) {
                        log.error(e);
                    }
                }
                log.debug("<== next rv=" + rv);
                return rv;
            }
        }

        class FolderIterator extends MaapiCursorIterator {
            ConfValue username;
            boolean firstGet;

            public FolderIterator(int tr, ConfValue username) throws
                    IOException,
                    ConfException {
                super(tr, OWNER_PATH);
                this.username = username;
                this.firstGet = true;
            }

            protected ConfKey getNext() {
                log.debug("==> getNext");
                ConfKey rv = null;
                if (cursor != null) {
                    try {
                        ConfKey ownershipKey = null;
                        ConfInt32 userId = getUserIdByUserName(tr, this
                                .username);
                        log.trace("usrId=" + userId);
                        ConfKey key = new ConfKey(userId);
                        if (this.firstGet) {
                            ownershipKey = maapi.findNext(cursor,
                                    ConfFindNextType.FIND_NEXT, key);
                            this.firstGet = false;
                        } else {
                            ownershipKey = maapi.getNext(cursor);
                        }
                        log.trace("ownershipKey=" + ownershipKey);
                        if (ownershipKey != null) {
                            ConfValue storageId = (ConfValue) ownershipKey
                                    .elementAt(1);
                            log.trace("storageId=" + storageId);
                            String storageIdStr = storageId.toString();
                            if (storageIdStr.contains(STORAGE_ID_SEPARATOR)) {
                                if (storageIdStr.startsWith(userId.toString()
                                )) {
                                    String folderId = storageIdStr.substring
                                            (storageIdStr.lastIndexOf
                                                    (STORAGE_ID_SEPARATOR)
                                                    + STORAGE_ID_SEPARATOR
                                                    .length());
                                    rv = new ConfKey(new ConfBuf(folderId));
                                }
                            }
                        }
                    } catch (IOException e) {
                        log.error(e);
                    } catch (ConfException e) {
                        log.error(e);
                    }
                }
                log.debug("<== next rv=" + rv);
                return rv;
            }
        }

        @DataCallback(callPoint = userFolders.callpoint_transcp,
                callType = {DataCBType.ITERATOR})
        public Iterator<ConfKey> iterator(DpTrans trans, ConfObject[] kp)
                throws IOException, ConfException {
            log.info("==> iterator kp=" + new ConfPath(kp));
            Iterator<ConfKey> rv = null;
            if (((ConfTag) kp[0]).getTagHash() == userFolders
                    .folders_folder_user) {
                rv = new UserIterator(trans.getTransaction());

            } else {
                if (((ConfTag) kp[0]).getTagHash() == userFolders
                        .folders_managed_folder) {
                    ConfValue username = (ConfValue) (((ConfKey)
                            kp[kp.length - 2]).elementAt(0));
                    rv = new FolderIterator(trans.getTransaction(), username);
                }
            }
            if ((rv == null)) throw new AssertionError();

            log.info("<== iterator");
            return rv;
        }

        @DataCallback(callPoint = userFolders.callpoint_transcp,
                callType = {DataCBType.GET_NEXT})
        public ConfKey getKey(DpTrans trans, ConfObject[] kp, Object obj)
                throws IOException, ConfException {
            log.info("==> getKey kp=" + new ConfPath(kp));
            ConfKey rv = (ConfKey) obj;
            log.info("<== getKey rv=" + rv);
            return rv;
        }

        @DataCallback(callPoint = userFolders.callpoint_transcp,
                callType = {DataCBType.GET_ELEM})
        public ConfValue getElem(DpTrans trans, ConfObject[] kp) throws
                IOException, ConfException {
            log.info("==> getElem kp=" + new ConfPath(kp));
            ConfValue rv = null;
            int tr = trans.getTransaction();
            int leafTag = ((ConfTag) kp[0]).getTagHash();
            int listTag = ((ConfTag) kp[2]).getTagHash();
            ConfValue username = (ConfValue) (((ConfKey) kp[kp.length - 2])
                    .elementAt(0));
            ConfValue folderId = (userFolders.folders_managed_folder ==
                    listTag) ? (ConfValue) (((ConfKey) kp[1]).elementAt(0))
                    : null;
            ConfBuf storageId = getLLStorageId(tr, username, folderId);
            log.trace("leafTag=" + leafTag + " listTag=" + listTag +
                    "username=" + username);
            ConfInt32 userId = getUserIdByUserName(tr, username);
            switch (leafTag) {
                case userFolders.folders_username:
                    log.trace("folders_username");
                    if (userId != null) {
                        rv = username;
                    }
                    break;
                case userFolders.folders_auth_password:
                    log.trace("folders_auth_password");
                    if (userStorage.storage_at_password == getLLAuthType(tr,
                            userId.intValue()).getOrdinalValue()) {
                        rv = maapi.getElem(tr, USER_PATH + "{" + userId +
                                "}/auth-info/password");
                    }
                    break;
                case userFolders.folders_auth_key:
                    log.trace("folders_auth_key");
                    if (userStorage.storage_at_key == getLLAuthType(tr,
                            userId.intValue()).getOrdinalValue()) {
                        rv = maapi.getElem(tr, USER_PATH + "{" + userId +
                                "}/auth-info/auth-key");
                    }
                    break;
                case userFolders.folders_folder_id:
                    log.trace("folders_folder_id");
                    if (storageId != null &&
                            maapi.exists(tr, STORAGE_PATH + "{" + storageId +
                                    "}")) {
                        // existence verified in low level, return the val from
                        // keypath - it saves the need to extract storage-id
                        // substring again...
                        rv = folderId;
                    }
                    break;
                case userFolders.folders_content_type:
                    log.trace("folders_content_type");
                    rv = getFolderContentType(tr, userId.intValue(), storageId);
                    break;
                default:
                    String text = "Unsupported tag! leafTag=" + leafTag;
                    log.error(text);
                    throw new ConfException(text);
            }
            log.info("<== getElem");
            return rv;
        }

        @DataCallback(callPoint = userFolders.callpoint_transcp,
                callType = {DataCBType.GET_CASE})
        public ConfObject getCase(DpTrans trans, ConfObject[] kp,
                                  ConfObject[] choice) throws IOException,
                ConfException {
            log.trace("==> getCase kp=" + new ConfPath(kp));

            ConfObject rv = null;
            int tr = trans.getTransaction();
            ConfValue username = (ConfValue) (((ConfKey) kp[kp.length - 2])
                    .elementAt(0));
            ConfInt32 userId = getUserIdByUserName(tr, username);
            if (userId != null) {
                ConfEnumeration authType = getLLAuthType(tr, userId.intValue());
                int folderAuthTag;
                switch (authType.getOrdinalValue()) {
                    case userStorage.storage_at_none:
                        folderAuthTag = userFolders.folders_none;
                        break;
                    case userStorage.storage_at_key:
                        folderAuthTag = userFolders.folders_key;
                        break;
                    case userStorage.storage_at_password:
                        folderAuthTag = userFolders.folders_password;
                        break;
                    default:
                        String text = "Unsupported auth-type! authType=" +
                                authType;
                        log.error(text);
                        throw new ConfException(text);
                }
                rv = new ConfTag(userFolders.hash, folderAuthTag);
            }

            log.info("<== getCase rv=" + rv);
            return rv;
        }

        @DataCallback(callPoint = userFolders.callpoint_transcp,
                callType = {DataCBType.EXISTS_OPTIONAL})
        public boolean existsOptional(DpTrans trans, ConfObject[] kp) throws
                IOException, ConfException {
            log.trace("==> existsOptional kp=" + new ConfPath(kp));

            boolean rv = false;
            int tr = trans.getTransaction();
            int leafTag = ((ConfTag) kp[0]).getTagHash();
            ConfValue username = (ConfValue) (((ConfKey) kp[1])
                    .elementAt(0));
            ConfInt32 userId = getUserIdByUserName(tr, username);
            switch (leafTag) {

                case userFolders.folders_auth_none:
                    rv = userStorage.storage_at_none == getLLAuthType(tr,
                            userId.intValue()).getOrdinalValue();
                    break;
                default:
                    String text = "Unsupported leaf! leafTag=" + leafTag;
                    log.error(text);
                    throw new ConfException(text);
            }
            log.info("<== existsOptional rv=" + rv);
            return rv;
        }

        @DataCallback(callPoint = userFolders.callpoint_transcp,
                callType = {DataCBType.SET_ELEM})
        public int setElem(DpTrans trans, ConfObject[] kp, ConfValue newval)
                throws IOException, ConfException {
            log.trace("==> getElem kp=" + new ConfPath(kp) + " newval=" +
                    newval);
            int rv = Conf.REPLY_OK;

            int tr = trans.getTransaction();
            int leafTag = ((ConfTag) kp[0]).getTagHash();
            int listTag = ((ConfTag) kp[2]).getTagHash();

            ConfValue username = (ConfValue) (((ConfKey) kp[kp.length - 2])
                    .elementAt(0));
            ConfValue folderId = (userFolders.folders_managed_folder ==
                    listTag) ? (ConfValue) (((ConfKey) kp[1]).elementAt(0))
                    : null;
            ConfInt32 userId = getUserIdByUserName(tr, username);
            ConfBuf storageId = getLLStorageId(tr, username, folderId);
            log.trace("leafTag=" + leafTag + " username=" + username +
                    " folderId=" + folderId + " storageId=" + storageId);

            switch (leafTag) {
                case userFolders.folders_content_type:
                    ConfBit32 val = contentTypeLeafListToBitmask((ConfList)
                            newval);
                    maapi.setElem(tr, val, OWNER_PATH + "{" + userId + " " +
                            storageId + "}/content-type");
                    break;
                case userFolders.folders_auth_key:
                    maapi.setElem(tr, new ConfEnumeration(userStorage
                            .storage_at_key), USER_PATH + "{" + userId +
                            "}/auth-info/auth-type");
                    maapi.setElem(tr, newval, USER_PATH + "{" + userId +
                            "}/auth-info/auth-key");
                    break;
                case userFolders.folders_auth_password:
                    maapi.setElem(tr, new ConfEnumeration(userStorage
                            .storage_at_password), USER_PATH + "{" + userId +
                            "}/auth-info/auth-type");
                    maapi.setElem(tr, newval, USER_PATH + "{" + userId +
                            "}/auth-info/password");
                    break;
                default:
                    String text = "Unsupported tag! leafTag=" + leafTag;
                    log.error(text);
                    throw new ConfException(text);
            }

            log.info("<== setElem rv=" + rv);
            return rv;
        }

        @DataCallback(callPoint = userFolders.callpoint_transcp,
                callType = {DataCBType.CREATE})
        public int create(DpTrans trans, ConfObject[] kp) throws
                IOException, ConfException {
            log.trace("==> create kp=" + new ConfPath(kp));
            int rv = Conf.REPLY_OK;

            int tr = trans.getTransaction();
            ConfValue username;
            if (kp[0] instanceof ConfTag) {
                log.debug("ConfTag last element of keypath");
                int leafTag = ((ConfTag) kp[0]).getTagHash();
                if (leafTag == userFolders.folders_auth_none) {
                    log.trace("processing userFolders.folders_auth_none");
                    username = (ConfValue) (((ConfKey) kp[1]).elementAt(0));
                    ConfInt32 userId = getUserIdByUserName(tr, username);
                    maapi.setElem(tr, new ConfEnumeration(userStorage
                            .storage_at_none), USER_PATH + "{" + userId +
                            "}/auth-info/auth-type");

                } else {
                    String text = "setElem: unexpected leafTag=" + leafTag;
                    log.error(text);
                    throw new ConnectException(text);
                }
            } else {
                int listTag = ((ConfTag) kp[1]).getTagHash();
                switch (listTag) {
                    case userFolders.folders_folder_user:
                        username = (ConfValue) (((ConfKey) kp[0]).elementAt(0));
                        log.trace("username=" + username);
                        int userIntId = getUnusedUserId(tr);
                        maapi.create(tr, USER_PATH + "{" + userIntId + "}");
                        maapi.setElem(tr, username, USER_PATH + "{"
                                + userIntId + "}/username");
                        break;
                    case userFolders.folders_managed_folder:
                        username = (ConfValue) (((ConfKey) kp[2]).elementAt(0));
                        ConfValue folderId = (ConfValue) (((ConfKey) kp[0])
                                .elementAt(0));
                        log.trace("username=" + username + " folderId=" +
                                folderId);
                        ConfInt32 userId = getUserIdByUserName(tr, username);
                        ConfValue storageId = getLLStorageId(tr, username,
                                folderId);
                        maapi.create(tr, STORAGE_PATH + "{" + storageId + "}");
                        maapi.create(tr, OWNER_PATH + "{" + userId + " " +
                                storageId + "}");
                        String mountPoint = MOUNTPOINT_PREFIX + "/" + userId
                                + "/" + folderId;
                        log.trace("mountPoint=" + mountPoint);
                        maapi.setElem(tr, mountPoint, STORAGE_PATH + "{" +
                                storageId + "}/mountpoint");
                        break;
                    default:
                        String text = "Unimplemented list! listTag=" + listTag;
                        log.error(text);
                        throw new ConfException(text);
                }
            }

            log.info("<== create rv=" + rv);
            return rv;
        }

        class XpathEvalIterOwnership implements MaapiXPathEvalResult {

            @Override
            public XPathNodeIterateResultFlag result(ConfObject[] kp,
                                                     ConfValue val,
                                                     Object tr) {
                log.trace("==> result kp=" + new ConfPath(kp) + " val=" + val);
                XPathNodeIterateResultFlag rv =
                        XPathNodeIterateResultFlag.ITER_CONTINUE;
                ConfValue userId = (ConfValue) (((ConfKey) kp[1])
                        .elementAt(0));
                ConfValue storageId = (ConfValue) (((ConfKey) kp[1])
                        .elementAt(1));
                try {
                    maapi.delete((Integer) tr, STORAGE_PATH + "{"
                            + storageId + "}");
                    maapi.delete((Integer) tr, OWNER_PATH + "{"
                            + userId + " " + storageId + "}");
                } catch (IOException e) {
                    log.error(e);
                    rv = XPathNodeIterateResultFlag.ITER_STOP;
                } catch (ConfException e) {
                    log.error(e);
                    rv = XPathNodeIterateResultFlag.ITER_STOP;
                }
                log.trace("<== result rv=" + rv);
                return rv;
            }
        }

        @DataCallback(callPoint = userFolders.callpoint_transcp,
                callType = {DataCBType.REMOVE})
        public int remove(DpTrans trans, ConfObject[] kp) throws IOException,
                ConfException {
            log.trace("==> remove kp=" + new ConfPath(kp));
            int rv = Conf.REPLY_OK;


            int tr = trans.getTransaction();
            ConfValue username = null;
            ConfInt32 userId = null;
            if (kp[0] instanceof ConfTag) {
                log.debug("ConfTag last element of keypath");
                int leafTag = ((ConfTag) kp[0]).getTagHash();
                if (kp.length > 2) {
                    username = (ConfValue) (((ConfKey) kp[kp.length - 2])
                            .elementAt(0));
                    userId = getUserIdByUserName(tr, username);
                }
                switch (leafTag) {
                    case userFolders.folders_auth_none:
                        // nothing needs to be done...
                        break;
                    case userFolders.folders_auth_key:
                        maapi.delete(tr, USER_PATH + "{" + userId +
                                "}/auth-info/key");
                        break;
                    case userFolders.folders_auth_password:
                        maapi.delete(tr, USER_PATH + "{" + userId +
                                "}/auth-info/password");
                        break;
                    default:
                        String text = "Unsupported tag! leafTag=" + leafTag;
                        log.error(text);
                        throw new ConfException(text);
                }
            } else {
                int listTag = ((ConfTag) kp[1]).getTagHash();

                switch (listTag) {
                    case userFolders.folders_folder_user:
                        username = (ConfValue) (((ConfKey) kp[0]).elementAt(0));
                        userId = getUserIdByUserName(tr, username);
                        String xpathExpr = OWNER_PATH + "[user-id=\"" +
                                userId + "\"]/user-id";
                        log.trace("xpath to check: " + xpathExpr);
                        maapi.xpathEval(tr, new XpathEvalIterOwnership(),
                                null, xpathExpr, null,
                                null, tr);
                        maapi.delete(tr, USER_PATH + "{" + userId + "}");
                        break;
                    case userFolders.folders_managed_folder:
                        username = (ConfValue) (((ConfKey) kp[2]).elementAt(0));
                        ConfValue folderId = (ConfValue) (((ConfKey) kp[0])
                                .elementAt(0));
                        ConfValue storageId = getLLStorageId(tr, username,
                                folderId);
                        userId = getUserIdByUserName(tr, username);
                        log.trace("username=" + username + " folderId=" +
                                folderId + " storageId=" + storageId +
                                " userId=" + userId);
                        maapi.delete(tr, STORAGE_PATH + "{" + storageId + "}");
                        maapi.delete(tr, OWNER_PATH + "{" + userId + " " +
                                storageId + "}");
                        break;
                    default:
                        String text = "Unimplemented list! listTag=" + listTag;
                        log.error(text);
                        throw new ConfException(text);
                }
            }

            log.info("<== remove rv=" + rv);
            return rv;
        }
    }

    public static int createDaemon() {
        log.info("==> createDaemon");
        int daemonRetVal = Conf.REPLY_OK;

        try {
            Maapi maapi = new Maapi(new Socket(CONFD_HOST, Conf.PORT));
            // create new control socket
            Socket ctrlSocket = new Socket(CONFD_HOST, Conf.PORT);
            // init and connect control socket
            Dp dp = new Dp("transforms", ctrlSocket);
            // register the transform callbacks
            dp.registerAnnotatedCallbacks(new TransCbs(maapi));
            dp.registerAnnotatedCallbacks(new TransformDataCbs(maapi));
            dp.registerDone();

            log.info("Transform example started");
            // read input from the control socket
            try {
                while (true) {
                    dp.read();
                }
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
