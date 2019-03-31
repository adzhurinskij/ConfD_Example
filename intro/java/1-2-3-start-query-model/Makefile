######################################################################
# Introduction example 1-2-3-start-query-model
# (C) 2006 Tail-f Systems
#
# See the README files for more information
######################################################################

usage:
	@echo "See README files for more instructions"
	@echo "make all       Build all example files"
	@echo "make java-all  Build all example files for Java"
	@echo "make clean   Remove all built and intermediary files"
	@echo "make start   Start CONFD daemon and example agent"
	@echo "make stop    Stop any CONFD daemon and example agent"
	@echo "make query   Run query against CONFD"
	@echo "make cli     Start the CONFD Command Line Interface, J-style"
	@echo "make cli-c   Start the CONFD Command Line Interface, C-style"

######################################################################
# Where is ConfD installed? Make sure CONFD_DIR points it out
CONFD_DIR ?= ../../..

# Include standard ConfD build definitions and rules
include $(CONFD_DIR)/src/confd/build/include.mk

# In case CONFD_DIR is not set (correctly), this rule will trigger
$(CONFD_DIR)/src/confd/build/include.mk:
	@echo 'Where is ConfD installed? Set $$CONFD_DIR to point it out!'
	@echo ''

######################################################################
# Example specific definitions and rules

CONFD_FLAGS = --addloadpath $(CONFD_DIR)/etc/confd
START_FLAGS ?=

JAVAC = javac
JAVA  = java


all:	java-all
		@echo "Build complete"

common-all: dhcpd.fxs $(CDB_DIR) ssh-keydir

java-all: common-all dhcpd.java DhcpConf.class
	@echo "Java build complete"

%.class:	%.java
	$(JAVAC) -classpath $(CLASSPATH):$(JLIB):. $*.java

%.java: %.fxs
	$(CONFDC) --emit-java $*.java $<


######################################################################
clean:	iclean
	-rm -rf dhcpd.java dhcpd.conf *.class *_ns.py *.pyc 2> /dev/null || true

######################################################################
start:  stop start_confd start_java_subscriber

start_confd:
	$(CONFD) -c confd.conf $(CONFD_FLAGS)

######################################################################

start_java_subscriber:
	$(JAVA) -classpath  $(CLASSPATH):$(JLIB):. DhcpConf $(START_FLAGS)

######################################################################
stop:
	### Killing any confd daemon or DHCP confd agents
	pgrep -f 'java.*[D]hcpConf' | xargs -r kill -9
	$(CONFD) --stop    || true


######################################################################
cli:
	$(CONFD_DIR)/bin/confd_cli --user=admin --groups=admin \
		--interactive || echo Exit

cli-c:
	$(CONFD_DIR)/bin/confd_cli -C --user=admin --groups=admin \
		--interactive  || echo Exit

######################################################################
query:
	$(CONFD_DIR)/bin/netconf-console cmd-get-dhcpd.xml

######################################################################
