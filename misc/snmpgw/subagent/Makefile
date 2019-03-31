######################################################################
# SNMP Agent example "mib-to-yang" Makefile
# (C) 2006-2009 Tail-f Systems
#
# See the README files for more information
######################################################################

usage:
	@echo "See README file for more instructions"
	@echo "make all      Build all example files"
	@echo "make clean    Remove all built and intermediary files"
	@echo "make start    Start ConfD daemon and example agent"
	@echo "make stop     Stop any ConfD daemon and example agent"
	@echo "make cli      Start the ConfD Command Line Interface"

######################################################################
# Where is ConfD installed? Make sure CONFD_DIR points it out
CONFD_DIR ?= ../../..

# Include standard ConfD build definitions and rules
include $(CONFD_DIR)/src/confd/build/include.mk

# In case CONFD_DIR is not set (correctly), this rule will trigger
$(CONFD_DIR)/src/confd/build/include.mk:
	@echo 'Where is ConfD installed? Set $$CONFD_DIR to point it out!'
	@echo ''

# Include common SNMP rules
include ./Makefile.incl

######################################################################
# Example specific definitions and rules

CONFD_FXS_DIR = $(CONFD_DIR)/etc/confd
CONFD_SNMP_FXS_DIR = $(CONFD_DIR)/etc/confd/snmp

CONFD_FLAGS = --addloadpath $(CONFD_FXS_DIR) \
	      --addloadpath $(CONFD_SNMP_FXS_DIR)

CONTENT_MIBS = IF-MIB.mib HOST-RESOURCES-MIB.mib SIMPLE-MIB.mib\
	       EXTRA-MIB.mib
IPC_PORT = 14565
GEN_DEVS = $(CONTENT_MIBS:%.mib=%-deviations.yang)
GEN_YANGS = $(CONTENT_MIBS:%.mib=%.yang)

MIBA_FILES = $(wildcard $*.miba)
MIBA = $(MIBA_FILES:%=--mib-annotation %)
DEVFILES = $(wildcard $*-*deviations.yang)\
	   $(filter $*-deviations.yang,$(GEN_DEVS))
DEVS = $(DEVFILES:%=--deviation %)

######################################################################

all:	$(CONTENT_MIBS:%.mib=%.fxs) $(CONTENT_MIBS:%.mib=%.bin) \
    sendtrap logs $(CDB_DIR) $(CDB_DIR)/vacm_init.xml
	@echo "Build complete"

logs:
	mkdir logs

EXTRA-MIB.fxs: DEVFILES += SIMPLE-MIB-deviations.yang

%: %.c
	$(CC) -o $@ $< $(CFLAGS) $(LIBS)

$(CONTENT_MIBS:%.mib=%.fxs): $(CONTENT_MIBS:%.mib=%.yang)
$(CONTENT_MIBS:%.mib=%.fxs): $(CONTENT_MIBS:%.mib=%-deviations.yang)
$(CONTENT_MIBS:%.mib=%.bin): $(CONTENT_MIBS:%.mib=%.fxs)
$(CONTENT_MIBS:%.mib=%.bin): $(CONTENT_MIBS:%.mib=%.mib)

%.fxs: %.yang
	$(CONFDC) $(EXTRA_LINK_FLAGS) -c -o $@ $(DEVS) $<

%.yang: %.mib
	$(CONFDC) --mib2yang-std -o $@ $<

%-deviations.yang: %.mib
	$(CONFDC) --mib2yang-mods $(MIBA) -o $@ $<

%.bin: %.fxs
	$(CONFDC) -c $(MIBA) -f . -f $(CONFD_FXS_DIR) -f $(CONFD_SNMP_FXS_DIR) \
	    -- $*.mib $*.fxs

$(CDB_DIR)/vacm_init.xml:
	-mkdir -p $(CDB_DIR)
	cp *_init.xml $(CDB_DIR)

######################################################################
clean:	iclean
	-rm -rf $(GEN_YANGS) $(GEN_DEVS) *.fxs *.bin global.data *.d \
	     $(GEN_YANGS) logs sendtrap EXTRA-MIB-deviations.yang \
	     IANAifType-MIB.yang HOST-RESOURCES-MIB-deviations.yang \
	     2>/dev/null || true
	-rm -rf *log *trace cli-history 2> /dev/null || true

start:  stop
	env sname=subagent $(CONFD) -c ./confd.conf $(CONFD_FLAGS)
	env CONFD_IPC_PORT=$(IPC_PORT) confd_load -o -l -m if_init_data.xml
	env CONFD_IPC_PORT=$(IPC_PORT) confd_load -o -l -m hr_init_data.xml
	env CONFD_IPC_PORT=$(IPC_PORT) confd_load -C if_init_data.xml
	env CONFD_IPC_PORT=$(IPC_PORT) confd_load -C hr_init_data.xml

######################################################################
stop:
	env CONFD_IPC_PORT=$(IPC_PORT) $(CONFD) --stop    || true

######################################################################

trap:
	./sendtrap -n $$trap_no

######################################################################
