######################################################################
# JSON-RPC API Intro example
# (C) 2017 Tail-f Systems
#
# See the README files for more information
######################################################################

usage:
	@echo "See README files for more instructions"
	@echo "make all     Build all example files"
	@echo "make clean   Remove all built and intermediary files"
	@echo "make start   Start CONFD daemon and example agent"
	@echo "make stop    Stop any CONFD daemon and example agent"
	@echo "make query   Run query against CONFD"
	@echo "make http    Browse to http://127.0.0.1:8008"
	@echo "make https   Browse to https://127.0.0.1:8888"
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

CONFD_HOST ?= 127.0.0.1
CONFD_FLAGS = --addloadpath $(CONFD_DIR)/etc/confd
START_FLAGS ?=

SRC	= cdb_oper_data.c
OBJS	= $(SRC:.c=.o)

all:	dhcpd.fxs dhcpd.h dhcpd-oper.fxs dhcpd-oper.h cdb_oper_data \
		$(CDB_DIR) ssh-keydir
	@echo "Build complete"

cdb_oper_data: $(OBJS)
	$(CC) -o $@ $(OBJS) $(LIBS)

######################################################################
clean:	iclean
	-rm -rf dhcpd.h dhcpd-oper.h cdb_oper_data 2> /dev/null || true
	-rm -rf *log cli-history 2> /dev/null || true

######################################################################
start:  stop start_confd start_oper_data

start_confd:
	$(CONFD) -c confd.conf $(CONFD_FLAGS)

start_oper_data:
	### * In one terminal window, run: tail -f ./confd.log
	### * In another terminal window, run queries
	###   (try 'make query' for an example)
	### * In this window, the DHCP confd daemon now starts:
	###   (hit Enter to exit)
	./cdb_oper_data $(START_FLAGS)

######################################################################
stop:
	### Killing any confd daemon or DHCP confd agents
	$(CONFD) --stop    || true
	$(KILLALL) cdb_oper_data || true

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
http:
	firefox http://$(CONFD_HOST):8008&
	# Switch to use the following when running on Mac
	# open http://$(CONFD_HOST):8008 -a firefox &

https:
	firefox https://$(CONFD_HOST):8888&
	# Switch to use the following when running on Mac
	# open https://$(CONFD_HOST):8888 -a firefox &
