/*********************************************************************
 * ConfD Config intro example, JAVA version
 *
 * (C) 2016 Tail-f Systems
 * Permission to use this code as a starting point hereby granted
 *
 * See the README file for more information
 ********************************************************************/

import org.apache.log4j.Logger;

import java.io.*;
import java.util.*;
import java.util.concurrent.locks.ReentrantLock;

/**
 * All methods not ending with ...Sync are not thread save and lock should be
 * gained, if necessary:
 * HostDb.getInstance().getLock().lock();
 * ...
 * * HostDb.getInstance().getLock().unlock();
 */
class HostDb {
    private static final Logger log = Logger.getRootLogger();
    private final ReentrantLock lock = new ReentrantLock();

    //singleton pattern
    private static HostDb instance = null;
    private List<Host> hosts = new LinkedList<Host>();

    protected HostDb() {
    }

    public static HostDb getInstance() {
        if (instance == null) {
            instance = new HostDb();
        }
        return instance;
    }

    public class Interface {
        String name;
        String ip, mask;
        boolean enabled;

        public Interface(String name, String ip, String mask,
                         boolean enabled) {
            this.name = name;
            this.ip = ip;
            this.mask = mask;
            this.enabled = enabled;
        }
    }

    class Host {
        String name, domain;
        String defGw;
        List<Interface> interfaces;

        public Host(String name, String domain, String defGw, List<Interface>
                interfaces) {
            this.name = name;
            this.domain = domain;
            this.defGw = defGw;
            this.interfaces = interfaces;
        }
    }

    public ReentrantLock getLock() {
        log.info("<==> getLock  lock.getHoldCount()=" + lock.getHoldCount() +
                " lock.getQueueLength()=" + lock.getQueueLength());
        return lock;
    }

    public Iterator<Object> getHostIterator() {
        log.trace("==> getHostIterator");
        Iterator iterator = hosts.iterator();
        log.trace("<== getHostIterator");
        return iterator;
    }

    public int numInstances() {
        log.trace("==> numInstances");
        int retVal = hosts.size();
        log.trace("<== numInstances retVal=" + retVal);
        return retVal;
    }

    public Iterator<Object> getInterfaceIterator(String hostName) {
        log.trace("==> getInterfaceIterator hostName=" + hostName);
        Iterator iterator = null;
        Host host = findHost(hostName);
        if (host != null && host.interfaces != null) {
            iterator = host.interfaces.iterator();
        }
        log.trace("<== getInterfaceIterator");
        return iterator;
    }

    public Host addHost(final String name, final String domain,
                        final String defGw) {
        log.trace("==> addHost name=" + name + " domain=" + domain + "" +
                " " +
                "defGwAsString=" + defGw);
        Host host = new Host(name, domain, defGw, new LinkedList<Interface>());
        hosts.add(host);
        Collections.sort(hosts, new Comparator<Host>() {
            @Override
            public int compare(Host h1, Host h2) {
                return h1.name.compareTo(h2.name);
            }
        });
        log.trace("<== addHost");
        return host;
    }

    public Host findHost(String hostName) {
        log.trace("==> findHost hostName=" + hostName);
        Host retHost = null;
        for (Host host : hosts) {
            if (host.name.equals(hostName)) {
                retHost = host;
                break;
            }
        }
        if (retHost != null) {
            log.trace("retHost.name=" + retHost.name);
        }
        log.trace("<== findHost");
        return retHost;
    }

    public Host deleteHost(String hostName) {
        log.trace("==> deleteHost hostName=" + hostName);
        Host retHost = null;
        for (Host host : hosts) {
            if (host.name.equals(hostName)) {
                retHost = host;
                break;
            }
        }
        if (retHost != null) {
            log.trace("retHost.name=" + retHost.name);
            hosts.remove(retHost);
        }
        log.trace("<== deleteHost");
        return retHost;
    }

    public Interface findIface(Host host, String ifaceName) {
        log.trace("==> findIface ifaceName=" + ifaceName);
        Interface retIface = null;
        for (Interface iface : host.interfaces) {
            if (iface.name.equals(ifaceName)) {
                retIface = iface;
                break;
            }
        }
        log.trace("<== findIface");
        return retIface;
    }

    public Interface deleteIface(Host host, String ifaceName) {
        log.trace("==> deleteIface ifaceName=" + ifaceName);
        Interface retIface = findIface(host, ifaceName);
        if (retIface != null) {
            log.trace("retIface.name=" + retIface.name);
            host.interfaces.remove(retIface);
        }
        log.trace("<== deleteIface");
        return retIface;
    }

    public void addIface(Host host, Interface iface) {
        log.trace("==> addIface iface.name=" + iface.name);
        host.interfaces.add(iface);
        Collections.sort(host.interfaces, new Comparator<Interface>() {
            @Override
            public int compare(Interface i1, Interface i2) {
                return i1.name.compareTo(i2.name);
            }
        });
        log.trace("<== addIface");
    }

    public void showDbSync() {
        log.trace("==> showDbSync");
        lock.lock();
        for (Host host : hosts) {
            showHostSync(host);
        }
        lock.unlock();
        log.trace("<== showDbSync");
    }

    private void clearDb() {
        log.trace("==> clearDb");
        hosts.clear();
        log.trace("<== clearDb");
    }

    public void defaultDbSync() {
        log.trace("==> defaultDb");
        lock.lock();
        clearDb();
        Host host = addHost("buzz", "tail-f.com", "192.168.1.1");
        host.interfaces.add(new Interface("eth0", "192.168.1.61",
                "255.255.255.0", true));
        host.interfaces.add(new Interface("eth1", "10.77.1.44",
                "255.255.0.0", false));
        host.interfaces.add(new Interface("lo", "127.0.0.1",
                "255.0.0.0", true));
        host = addHost("earth", "tailf-com", "192.168.1.1");
        host.interfaces.add(new Interface("bge0", "192.168.1.61",
                "255.255.255.0", true));
        host.interfaces.add(new Interface("lo0", "127.0.0.1",
                "255.0.0.0", true));
        lock.unlock();
        log.trace("<== defaultDb");
    }

    public void showHostSync(Host host) {
        log.trace("==> showHostSync");
        lock.lock();
        System.out.format("Host %10s %10s %10s%n", host.name, host.domain,
                host.defGw);
        for (Interface iface : host.interfaces) {
            System.out.format("   iface: %7s %10s %10s %4d%n", iface.name,
                    iface.ip, iface.mask, iface.enabled ? 1 : 0);
        }
        lock.unlock();
        log.trace("<== showHostSync");
    }

    boolean dumpDbSync(String fileName) {
        log.trace("==> dumpDbSync fileName=" + fileName);
        boolean retVal = false;
        lock.lock();
        File file = new File(fileName);
        Formatter fmt;

        try {
            fmt = new Formatter(file);
            for (Host host : hosts) {
                fmt.format("%s %s %s { ", host.name, host.domain,
                        host.defGw);
                for (Interface iface : host.interfaces) {
                    fmt.format(" %s %s %s %d ", iface.name, iface.ip,
                            iface.mask, iface.enabled ? 1 : 0);
                }
                fmt.format(" }%n");
            }
            fmt.flush();
            fmt.close();
            retVal = true;
        } catch (FileNotFoundException e) {
            log.error(e);
        }

        lock.unlock();
        log.trace("<== dumpDbSync retVal=" + retVal);
        return retVal;
    }

    boolean loadDbSync(String fileName) {
        log.trace("==> loadDbSync fileName=" + fileName);
        boolean retVal = false;
        List<Host> loadHosts = new LinkedList<Host>();
        FileInputStream fstream;
        lock.lock();

        try {
            fstream = new FileInputStream(fileName);
            BufferedReader br = new BufferedReader(new InputStreamReader
                    (fstream));
            String line;
            boolean wrongLine = false;
            while ((line = br.readLine()) != null) {
                log.trace("processing line=" + line);
                String[] lineArgs = line.trim().split("\\s+");
                log.trace("lineArgs=" + Arrays.asList(lineArgs));

                if (lineArgs.length >= 3) {
                    Host loadHost = new Host(lineArgs[0], lineArgs[1],
                            lineArgs[2], new LinkedList<Interface>());
                    loadHosts.add(loadHost);
                    if (lineArgs.length >= 4 && lineArgs[3].equals("{") &&
                            lineArgs[lineArgs.length - 1].equals("}")) {
                        //process interfaces
                        int startIdx = 4;
                        int endIdx = lineArgs.length - 2;
                        while (endIdx > startIdx) {
                            log.trace("startIdx=" + startIdx);
                            log.trace("endIdx=" + endIdx);
                            if (endIdx - startIdx >= 3) { //4 items
                                loadHost.interfaces.add(new Interface
                                        (lineArgs[startIdx],
                                                lineArgs[startIdx + 1],
                                                lineArgs[startIdx + 2],
                                                lineArgs[startIdx + 3]
                                                        .equals("1")));
                            } else {
                                log.error("Not enough items to make " +
                                        "interface!");
                                wrongLine = true;
                            }
                            startIdx += 4; //to next interface  or finish
                        }
                    } else {
                        log.error("Missing interface section!");
                        wrongLine = true;
                        break;
                    }
                } else {
                    log.error("Not enough items to make host!");
                    wrongLine = true;
                    break;
                }
            }

            br.close();
            if (wrongLine) {
                System.out.println("Wrong line: " + line);
            } else {
                retVal = true;
            }
        } catch (FileNotFoundException e) {
            log.error(e);
        } catch (IOException e) {
            log.error(e);
        }

        if (retVal) {
            hosts = loadHosts;
        }

        lock.unlock();
        log.trace("<== loadDbSync retVal=" + retVal);
        return retVal;
    }
}
