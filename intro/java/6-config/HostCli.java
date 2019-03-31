/*********************************************************************
 * ConfD Config intro example, JAVA version
 *
 * (C) 2016 Tail-f Systems
 * Permission to use this code as a starting point hereby granted
 *
 * See the README file for more information
 ********************************************************************/

import org.apache.log4j.Logger;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Scanner;

class HostCli implements Runnable {
    private static final Logger log = Logger.getRootLogger();
    private HostDb.Host currHost;
    private String prompt;

    public void run() {
        log.info("==> run");
        setCurrHostAndPrompt(null);
        Scanner scanner = new Scanner(System.in);
        String line = "";
        while (!"quit".equals(line)) {
            System.out.print(prompt);
            line = scanner.nextLine();

            if ("quit".equals(line)) {
                continue;
            }

            if ("show".equals(line)) {
                if (currHost == null) {
                    HostDb.getInstance().showDbSync();
                } else {
                    HostDb.getInstance().showHostSync(currHost);
                }
                continue;
            }


            if ("up".equals(line)) {
                setCurrHostAndPrompt(null);
                continue;
            }

            if ("default".equals(line)) {
                HostDb.getInstance().defaultDbSync();
                setCurrHostAndPrompt(null);
                continue;
            }

            if (line.startsWith("dump")) {
                processDump(line);
                continue;
            }

            if (line.startsWith("load")) {
                processLoad(line);
                continue;
            }

            if (line.startsWith("host")) {
                processHost(line);
                continue;
            }

            if (line.startsWith("iface")) {
                processIface(line);
                continue;
            }

            if (line.startsWith("del")) {
                processDel(line);
                continue;
            }

            printHelp();
        }
        log.debug("Ending CLI");
        log.info("<== run");
    }

    private void processDump(String line) {
        log.trace("==> processDump line=" + line);
        String fileName = "RUNNING.db";
        if (!"dump".equals(line)) {
            String[] dumpArg = line.split(" ");
            fileName = dumpArg[1];
        }
        if (!HostDb.getInstance().dumpDbSync(fileName)) {
            System.out.println("failed to dump to " + fileName);
        }
        log.trace("<== processDump");
    }

    private void processLoad(String line) {
        log.trace("==> processLoad line=" + line);

        String[] loadArg = line.split(" ");
        if (loadArg.length != 2) {
            System.out.println("usage: load <file>");
        } else {
            if (!HostDb.getInstance().loadDbSync(loadArg[1])) {
                System.out.println("failed to open " + loadArg[1] + " for " +
                        "reading");
            }
        }

        log.trace("<== processLoad");
    }

    private void processHost(String line) {
        log.trace("==> processHost line=" + line);
        HostDb.Host host = null;
        if ("host".equals(line)) {
            log.trace("host - not enough arguments");
            System.out.println("usage: host <hname> | host <hname " +
                    "domain defgw>");
        } else {
            String[] hostArg = line.split(" ");
            log.trace("hostArg=" + new ArrayList<String>(Arrays.asList
                    (hostArg)));
            HostDb.getInstance().getLock().lock();
            host = HostDb.getInstance().findHost(hostArg[1]);
            HostDb.getInstance().getLock().unlock();
            if (host == null) {
                log.trace("create host");
                if (hostArg.length != 4) {
                    log.trace("host - not enough arguments to create");
                    System.out.println("usage: host <newhost> <domain> " +
                            "<defgw>");
                } else {
                    host = HostDb.getInstance().addHost(hostArg[1],
                            hostArg[2],
                            hostArg[3]);
                }
            }
        }
        setCurrHostAndPrompt(host);
        log.trace("<== processHost");
    }

    private void processDel(String line) {
        log.trace("==> processDel line=" + line);
        String[] delArg = line.split(" ");
        if (currHost == null) {
            if (delArg.length == 1) {
                System.out.println("usage: del <hname>");
            } else {
                HostDb.getInstance().getLock().lock();
                HostDb.Host host = HostDb.getInstance().deleteHost
                        (delArg[1]);
                HostDb.getInstance().getLock().unlock();
                if (host == null) {
                    System.out.println("Host " + delArg[1] + " not found!");
                }
            }
        } else {
            if (delArg.length == 1) {
                System.out.println("usage: del <ifname>");
            } else {
                HostDb.getInstance().getLock().lock();
                HostDb.Interface iface = HostDb.getInstance()
                        .deleteIface(currHost, delArg[1]);
                HostDb.getInstance().getLock().unlock();
                if (iface == null) {
                    System.out.println("Interface " + delArg[1] + " not " +
                            "found!");
                }
            }
        }
        log.trace("<== processDel");
    }

    private void processIface(String line) {
        log.trace("==> processIface line=" + line);
        if (currHost == null) {
            log.trace("host - not selected");
            System.out.println("Need to pick a host before we can create " +
                    "iface");
        } else {
            String[] ifaceArg = line.split(" ");
            log.trace("ifaceArg=" + new ArrayList<String>(Arrays.asList
                    (ifaceArg)));
            if (ifaceArg.length != 5) {
                log.trace("iface - not enough arguments to create");
                System.out.println("usage: iface <name> <ip> <mask> <ena>");
            } else {
                Boolean enabled = ifaceArg[4].equals("1");
                HostDb.Interface iface = HostDb.getInstance().new Interface
                        (ifaceArg[1], ifaceArg[2], ifaceArg[3], enabled);
                HostDb.getInstance().getLock().lock();
                HostDb.getInstance().addIface(currHost, iface);
                HostDb.getInstance().getLock().unlock();
            }
        }
        log.trace("<== processIface line=" + line);
    }

    static private void printHelp() {
        log.trace("==> printHelp");
        System.out.println("show ");
        System.out.println("host [hostname]");
        System.out.println("host <name> <domain> <defgw>    - to create " +
                "new host");
        System.out.println("iface <name> <ip> <mask> <ena>  - to create " +
                "new iface");
        System.out.println("del <hostname | ifacename>");
        System.out.println("up ");
        System.out.println("quit ");
        System.out.println("default      -  to load default db values");
        System.out.println("load <file>  -  to load db from <file> ");
        System.out.println("dump <file>  -  to dump db to <file> ");
        log.trace("<== printHelp");
    }

    private void setCurrHostAndPrompt(HostDb.Host host) {
        log.trace("==> setCurrHostAndPrompt");
        currHost = host;
        if (currHost == null) {
            prompt = "> ";
        } else {
            prompt = "[" + currHost.name + "] > ";
        }
        log.trace("<== setCurrHostAndPrompt prompt=" + prompt);
    }
}
