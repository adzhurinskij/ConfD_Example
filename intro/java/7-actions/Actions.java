/*********************************************************************
 * ConfD Actions intro example, JAVA version
 * Implements a data provider for operational data and action.
 *
 * (C) 2016 Tail-f Systems
 * Permission to use this code as a starting point hereby granted
 *
 * See the README file for more information
 ********************************************************************/

import com.tailf.conf.*;
import com.tailf.dp.Dp;
import com.tailf.dp.DpActionCallback;
import com.tailf.dp.DpActionTrans;
import com.tailf.dp.DpCallbackException;
import com.tailf.dp.annotations.ActionCallback;
import com.tailf.dp.proto.ActionCBType;
import org.apache.log4j.Logger;

import java.net.Socket;
import java.util.Arrays;
import java.util.concurrent.SynchronousQueue;
import java.util.concurrent.TimeUnit;

public final class Actions {
    private static final Logger log = Logger.getRootLogger();
    private static final int MAX_SESSIONS = 10;
    private static final String CONFD_HOST = "127.0.0.1";
    private static int daemonRetVal = Conf.REPLY_OK;

    /**
     * @see DpActionCallback
     */
    public final static class CbRebootPointAction {
        @ActionCallback(callPoint = config.actionpoint_reboot_point, callType =
                ActionCBType.ACTION)
        public ConfXMLParam[] doActionRebootPoint(final DpActionTrans trans,
                                                  final ConfTag name,
                                                  final ConfObject[] keyPath,
                                                  final ConfXMLParam[] params)
                throws DpCallbackException {
            log.info("==> doActionRebootPoint keyPath=" + new ConfPath
                    (keyPath) + " name=" + name.toString());

            ConfXMLParam p;
            String result;
            for (int i = 0; i < params.length; i++) {
                p = params[i];
                log.info("param " + i + " ns:" + p.getConfNamespace() +
                        "tagHash:" + p.getTagHash() + " tag:" + p.getTag() +
                        " value:" + p.getValue());
            }

            ConfXMLParam[] retVal = null;
            trans.setTransactionUserOpaque(Thread.currentThread());
            switch (name.getTagHash()) {

                case config.config_reboot:
                    log.info(config.config_reboot_);
                    /* no params */
                    break;

                case config.config_restart:
                    log.info(config.config_restart_);
                    p = params[0];
                    log.trace("p.getTag() " + p.getTag() + " p.getValue() " +
                            p.getValue());
                    result = p.getValue().toString();

                    if (result.equals("error1")) {
                        log.warn(p.getValue());
                        throw new DpCallbackException("Parameter " +
                                p.getValue() + " detected");
                    }
                    if (result.equals("error2")) {
                        log.warn(p.getValue());
                        throw new DpCallbackException("myfail");
                    }
                    result += "-result";
                    for (ConfXMLParam param : params) {
                        switch (param.getTagHash()) {
                            case config.config_debug:
                                result += "-debug";
                                break;
                            case config.config_foo:
                                result += "-foo";
                                break;
                            default:
                                break;
                        }
                    }
                    retVal = new ConfXMLParam[1];
                    retVal[0] = new ConfXMLParamValue(config.hash, config
                            .config_time,
                            new ConfBuf(result));
                    break;

                case config.config_reset:
                    log.info(config.config_reset_);
                    p = params[0];
                    log.trace("p.getTag() " + p.getTag() + " p.getValue() " +
                            p.getValue());
                    result = p.getValue().toString();
                    result += "-result";
                    retVal = new ConfXMLParam[1];
                    retVal[0] = new ConfXMLParamValue(config.hash, config
                            .config_time,
                            new ConfBuf(result));
                    break;

                case config.config_abort_test:
                    log.trace(config.config_abort_test_);
                    // In Java we do not use CONFD_DELAYED_RESPONSE  (used in C
                    // version) to demonstrate abort (not available). We sleep
                    // for 10seconds, which can be aborted by user with CTRL+C
                    try {
                        Thread.sleep(10 * 1000);
                    } catch (InterruptedException e) {
                        log.warn("Sleep in action" +
                                " doActionRebootPoint interrupted!");
                    }
                    break;

                default:
                    DpCallbackException e = new DpCallbackException("Bad " +
                            "operation!");
                    log.error(e);
                    throw e;
            }
            log.info("<== doActionRebootPoint retVal=" + (retVal == null ?
                    null : Arrays.toString(retVal)));
            return retVal;
        }

        @ActionCallback(callPoint = config.actionpoint_reboot_point, callType =
                ActionCBType.INIT)
        public void initActionRebootPoint(final DpActionTrans trans) throws
                DpCallbackException {
            log.info("==> initActionRebootPoint");
            log.info("<== initActionRebootPoint");
        }

        @ActionCallback(callPoint = config.actionpoint_reboot_point, callType =
                ActionCBType.ABORT)
        public void abortActionRebootPoint(final DpActionTrans trans) throws
                DpCallbackException {
            log.info("==> abortActionRebootPoint");
            log.info("Aborting outstanding action");
            final Object opaque = trans.getTransactionUserOpaque();
            if (opaque instanceof Thread) {
                log.debug("Aborting action thread " + ((Thread) opaque)
                        .getName());
                ((Thread) opaque).interrupt();
            } else {
                log.error("Cannot abort action thread, opaque not set!");
                throw new DpCallbackException("Cannot abort action thread");
            }
            log.info("<== abortActionRebootPoint");
        }
    }

    public final static int createDaemon() {
        log.info("==> createDaemon daemonRetVal=" + daemonRetVal);


        try {
            final Socket ctrl_socket = new Socket(CONFD_HOST, Conf.PORT);
            final Dp dataProv = new Dp("action_daemon", ctrl_socket, false, 2,
                    MAX_SESSIONS + 2,
                    60L, TimeUnit.SECONDS, new SynchronousQueue(), true);

            dataProv.registerAnnotatedCallbacks(new Actions
                    .CbRebootPointAction());

            dataProv.registerDone();
            final Thread dpTh = new Thread(new Runnable() {
                public void run() {
                    try {
                        while (true) {
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
