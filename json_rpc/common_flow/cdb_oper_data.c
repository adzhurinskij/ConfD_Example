/*********************************************************************
 * ConfD JSON-RPC common flow example
 * Implement live data for operational stored in CDB
 *
 * (C) 2017 Tail-f Systems
 * Permission to use this code as a starting point hereby granted
 *
 * See the README file for more information
 ********************************************************************/

#include <stdlib.h>
#include <unistd.h>
#include <netinet/in.h>
#include <confd.h>
#include <confd_cdb.h>
#include "dhcpd-oper.h"

#define OK(rval) do {                                                   \
        if ((rval) != CONFD_OK)                                         \
            confd_fatal("cdb_oper_data: error not CONFD_OK: %d : %s\n", \
                        confd_errno, confd_lasterr());                  \
    } while (0);

void gen_value(confd_value_t *value) {
    long addr_in_useCounter = 0;
    addr_in_useCounter += random() % 50;
    if (addr_in_useCounter > 253)
        addr_in_useCounter = 253;
    CONFD_SET_UINT32(value, addr_in_useCounter);
}

int main(int argc, char **argv) {
    int sock;
    struct sockaddr_in addr;
    confd_value_t addr_in_use_value;

    addr.sin_addr.s_addr = inet_addr("127.0.0.1");
    addr.sin_family = AF_INET;
    addr.sin_port = htons(CONFD_PORT);

    confd_init("cdb_oper_data", stderr, CONFD_TRACE);
    OK(confd_load_schemas((struct sockaddr*)&addr, sizeof(struct sockaddr_in)));

    if ((sock = socket(PF_INET, SOCK_STREAM, 0)) < 0)
        confd_fatal("Failed to create socket");

    OK(cdb_connect(sock, CDB_DATA_SOCKET, (struct sockaddr *)&addr,
                   sizeof(struct sockaddr_in)));
    OK(cdb_start_session2(
        sock, CDB_OPERATIONAL, CDB_LOCK_REQUEST | CDB_LOCK_WAIT
    ));
    OK(cdb_set_namespace(sock, do__ns));

    while (1) {

        gen_value(&addr_in_use_value);

        OK(
            cdb_set_elem(
                sock,
                &addr_in_use_value,
                "/stat/addr_in_use"
            )
        );

        sleep(10);
    }
}
