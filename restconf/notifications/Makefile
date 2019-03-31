######################################################################
# NETCONF Notification example
# (C) 2006-2009 Tail-f Systems
#
# See the README file for more information
######################################################################

usage:
	@echo "See README file for more instructions"
	@echo "make all              	 Build all example files"
	@echo "make clean            	 Remove all built and intermediary files"
	@echo "make start            	 Start ConfD daemon and example notifier app using the builtin"
	@echo "                      	 replay store"
	@echo "make start-builtin    	 Start ConfD daemon and example notifier app using the builtin"
	@echo "                      	 replay store"
	@echo "make start-external   	 Start ConfD daemon and example notifier app using an external"
	@echo "                      	 replay store"
	@echo "make stop             	 Stop any ConfD daemon and example notifier app"
	@echo "make rc-location          Run NETCONF query against ConfD"
	@echo "make rc-subscribe         Subscribe for the interface stream using RESTCONF"
	@echo "make rc-replay            Replay the interface stream using RESTRCONF"
	@echo "make rc-filter            Replay the interface stream with a filter using RESTRCONF"
	@echo "make rc-subscribe-netconf Subscribe for the NETCONF stream using the RESTCONF protocol"
	@echo "make cli     	     	 Start the CONFD Command Line Interface"
	@echo "make cli-c   	     	 Start the CONFD Command Line Interface, C-style"
	@echo "make cli-j   	     	 Start the CONFD Command Line Interface, J-style"

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


CFLAGS	+= $(EXPAT_INC)
LIBS	+= $(EXPAT_LIB)

all: notifier notifier_builtin_replay_store notif.fxs $(CDB_DIR) ssh-keydir
	@echo "Build complete"

notifier: notifier.o
	 $(CC) notifier.o $(LIBS) $(CFLAGS) -ansi -pedantic -o $@

notifier.o: notifier.c notif.h

notifier_builtin_replay_store: notifier_builtin_replay_store.o
	 $(CC) notifier_builtin_replay_store.o $(LIBS) $(CFLAGS) -o $@

notifier_builtin_replay_store.o: notifier_builtin_replay_store.c notif.h

%.h: %.fxs
	$(CONFDC) --emit-h $*.h $<

######################################################################
clean:	iclean
	-rm -rf notifier notifier_builtin_replay_store *.h interface.*\
		confd_prim.conf 2> /dev/null || true

start:  start-builtin

start-builtin:  stop
	sed 's/[ \t]*<!-- enableBuiltinReplayStore -->/          <enabled>true<\/enabled>/' confd.conf > confd_prim.conf
	$(CONFD) -c ./confd_prim.conf $(CONFD_FLAGS)
	LD_LIBRARY_PATH=$(CONFD_SO) ./notifier_builtin_replay_store -t

start-external:  stop
	sed 's/[ \t]*<!-- enableBuiltinReplayStore -->/          <enabled>false<\/enabled>/' confd.conf > confd_prim.conf
	$(CONFD) -c ./confd_prim.conf $(CONFD_FLAGS)
	LD_LIBRARY_PATH=$(CONFD_SO) ./notifier -t

######################################################################
stop:
	### Stopping any confd daemon
	$(CONFD) --stop || true
	$(KILLALL) -r notifier || true

######################################################################
rc-query-xml:
	curl -i -X "GET" -H "Accept: application/yang-data+xml" -u admin:admin http://localhost:8008/restconf/data/ietf-restconf-monitoring:restconf-state/streams

rc-query-json:
	curl -i -X "GET" -H "Accept: application/yang-data+json" -u admin:admin http://localhost:8008/restconf/data/ietf-restconf-monitoring:restconf-state/streams

rc-location-xml:
	curl -i -X "GET" -H "Accept: application/yang-data+xml" -u admin:admin http://localhost:8008/restconf/data/ietf-restconf-monitoring:restconf-state/streams/stream=interface/access=xml/location

rc-location-json:
	curl -i -X "GET" -H "Accept: application/yang-data+json" -u admin:admin http://localhost:8008/restconf/data/ietf-restconf-monitoring:restconf-state/streams/stream=interface/access=json/location

rc-subscribe-xml:
	curl -i -X "GET" -H "Accept: text/event-stream" -u admin:admin http://localhost:8008/restconf/streams/interface/xml

rc-subscribe-json:
	curl -i -X "GET" -H "Accept: text/event-stream" -u admin:admin http://localhost:8008/restconf/streams/interface/json

rc-replay-xml:
	curl -i -X "GET" -H "Accept: text/event-stream" -u admin:admin http://localhost:8008/restconf//streams/interface/xml?start-time=2007-07-28T15%3A23%3A36Z

rc-replay-json:
	curl -i -X "GET" -H "Accept: text/event-stream" -u admin:admin http://localhost:8008/restconf//streams/interface/json?start-time=2007-07-28T15%3A23%3A36Z

rc-filter-xml:
	curl -i -X "GET" -H "Accept: text/event-stream" -u admin:admin http://localhost:8008/restconf//streams/interface/xml?filter=%2FlinkDown

rc-filter-json:
	curl -i -X "GET" -H "Accept: text/event-stream" -u admin:admin http://localhost:8008/restconf//streams/interface/json?filter=%2FlinkDown

rc-subscribe-netconf-xml:
	curl -i -X "GET" -H "Accept: text/event-stream" -u admin:admin http://localhost:8008/restconf/streams/NETCONF/xml

rc-subscribe-netconf-json:
	curl -i -X "GET" -H "Accept: text/event-stream" -u admin:admin http://localhost:8008/restconf/streams/NETCONF/json

edit-config1:
	$(CONFD_DIR)/bin/netconf-console --edit-config=edit1.xml

edit-config2:
	$(CONFD_DIR)/bin/netconf-console --edit-config=edit2.xml

######################################################################

cli:
	$(CONFD_DIR)/bin/confd_cli --user=admin --groups=admin \
		--interactive || echo Exit

cli-c:
	$(CONFD_DIR)/bin/confd_cli -C --user=admin --groups=admin \
		--interactive || echo Exit

cli-j:
	$(CONFD_DIR)/bin/confd_cli -J --user=admin --groups=admin \
		--interactive || echo Exit
