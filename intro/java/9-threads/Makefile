######################################################################
# Introduction example 9-c_threads
# (C) 2006 Tail-f Systems
#
# See the README file for more information
######################################################################

usage:
	@echo "See README file for more instructions"
	@echo "make all     Build all example files"
	@echo "make clean   Remove all built and intermediary files"
	@echo "make start   Start CONFD daemon and example agent"
	@echo "make stop    Stop any CONFD daemon and example agent"
	@echo "make restart Stop and restart the CONFD daemon only"
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

common-all: model.fxs $(CDB_DIR) ssh-keydir

java-all: common-all model.java ThrDaemon.class
	@echo "Java build complete"

all: java-all
	@echo "Build complete"

%.class:	%.java
	$(JAVAC) -classpath $(CLASSPATH):$(JLIB):. $*.java

%.java: %.fxs
	$(CONFDC) --emit-java $*.java $<

######################################################################
clean:	iclean
	-rm -rf model.java *.class 2> /dev/null || true
	-rm -rf *log *trace cli-history 2> /dev/null || true

start:  stop start_confd start_java

start_confd:
	$(CONFD) -c confd.conf $(CONFD_FLAGS)

start_java:
	$(JAVA) -classpath  $(CLASSPATH):$(JLIB):. ThrDaemon $(START_FLAGS)

######################################################################
stop:
	### Killing any confd daemon and data provider daemons
	pgrep -f 'java.*[T]hrDaemon' | xargs -r kill -9
	$(CONFD) --stop || true

######################################################################
restart:
	### Restarting the confd daemon
	$(CONFD) --stop || true
	sleep 3
	$(CONFD) -c confd.conf $(CONFD_FLAGS)

######################################################################
cli:
	$(CONFD_DIR)/bin/confd_cli --user=admin --groups=admin \
		--interactive || echo Exit

cli-c:
	$(CONFD_DIR)/bin/confd_cli -C --user=admin --groups=admin \
		--interactive || echo Exit

######################################################################
