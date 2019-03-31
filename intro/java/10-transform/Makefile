######################################################################
# Transform example  java/10-transform
# (C) 2017-2018 Tail-f Systems
#
# See the README file for more information
######################################################################

usage:
	@echo "See README file for more instructions"
	@echo "make all     Build all example files"
	@echo "make clean   Remove all built and intermediary files"
	@echo "make start   Start CONFD daemon and example agent"
	@echo "make stop    Stop any CONFD daemon and example agent"
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
	@exit 1

######################################################################
# Example specific definitions and rules

print-%  : ; @echo $* = $($*)

CONFD_FLAGS = --addloadpath $(CONFD_DIR)/etc/confd --addloadpath $(BUILD_DIR)/
START_FLAGS ?=

JAVAC = javac
JAVA  = java

BUILD_DIR = ./build
YANG_DIR = ./yangs
SRC_DIR = ./src

YANGS = $(wildcard $(YANG_DIR)/*.yang)
FXSS = $(patsubst $(YANG_DIR)/%.yang, $(BUILD_DIR)/%.fxs, $(YANGS))
JAVA_FXS = $(FXSS:.fxs=.java)

$(BUILD_DIR):
	mkdir -p $(BUILD_DIR)

$(BUILD_DIR)/%.fxs: $(YANG_DIR)/%.yang
	$(CONFDC) -o $@ -c $<

common-all: $(BUILD_DIR) $(FXSS) $(CDB_DIR) ssh-keydir

$(BUILD_DIR)/%.class: $(SRC_DIR)/%.java

$(BUILD_DIR)/%.class:	 $(SRC_DIR)/%.java
	$(JAVAC) -classpath $(CLASSPATH):$(BUILD_DIR):$(JLIB):. -d $(BUILD_DIR) $(SRC_DIR)/$*.java

java-all: common-all $(JAVA_FXS) $(BUILD_DIR)/UserStorageTransformApp.class
	@echo "Java build complete"

all: java-all
	@echo "Build complete"


%.java: %.fxs
	$(CONFDC) --emit-java $*.java $<

######################################################################
DIRS_TO_CLEAN = $(BUILD_DIR)

clean:	iclean
	-rm -rf $(DIRS_TO_CLEAN) 2> /dev/null || true

clean_delete_cli_history:	clean
	-rm -rf cli-history 2> /dev/null || true

start:  stop start_confd start_java

start_confd:
	$(CONFD) -c confd.conf $(CONFD_FLAGS)

start_java:
	$(JAVA) -classpath  $(CLASSPATH):$(BUILD_DIR):$(JLIB):. UserStorageTransformApp $(START_FLAGS)

######################################################################
stop:
	### Killing any confd daemon and data provider daemons
	pgrep -f 'java.*[U]serStorageTransformApp' | xargs -r kill -9
	$(CONFD) --stop || true

######################################################################
cli:
	$(CONFD_DIR)/bin/confd_cli --user=admin --groups=admin \
		--interactive || echo Exit

cli-c:
	$(CONFD_DIR)/bin/confd_cli -C --user=admin --groups=admin \
		--interactive || echo Exit

######################################################################
query:
	$(CONFD_DIR)/bin/netconf-console-tcp -u admin --get-config
######################################################################
