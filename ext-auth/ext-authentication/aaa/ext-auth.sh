#!/bin/sh

# Script demonstrating simple external authentication
#
# Expected input (on stdin): "[<username>;<password>;]\n"
#
# Expected output: "accept $groups $uid $gid $supplementary_gids $HOME\n"
# o $groups is a space separated list of the group names the user is a member of.
# o $uid is the UNIX integer user id ConfD should use as default when
#   executing commands for this user.
# o $gid is the UNIX integer group id ConfD should use as default when executing
#   commands for this user.
# o $supplementary_gids is a (possibly empty) space separated list of additional
#   UNIX group ids the user is also a member of.
# o $HOME is the directory which should be used as HOME for this user when ConfD
#   executes commands on behalf of this user.
#

read INPUT
user=$(echo $INPUT | sed -n 's/\[\(.*\);\(.*\);\]/\1/p')
pass=$(echo $INPUT | sed -n 's/\[\(.*\);\(.*\);\]/\2/p')

if [ "$user" = "alice" ] && [ "$pass" = "alice" ]; then
    echo "accept 9000 20 'homes/alice'"
elif [ "$user" = "bob" ] && [ "$pass" = "bob" ]; then
    echo "accept 9000 20 'homes/bob'"
else
    echo "reject 'permission denied'"
fi
