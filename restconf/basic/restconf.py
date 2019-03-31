#! /usr/bin/env python
#
#  Demonstrates basic usage of ConfD RESTful API using the Python 'requests'
#  package.  www.python-requests.org.
#
#  Assumes examples.confd/restconf/basic is running
#

from __future__ import print_function

import requests
import json

AUTH     = ('admin','admin')            # tuple of username, password
BASE_URL = 'http://localhost:8008/restconf'
RR_URL   = 'http://localhost:8008/.well-known/host-meta'

# media types
MT_ANY            = '*/*'
MT_RR             = 'application/xrd'
MT_BASE           = 'application/yang-data'
MT_COLLECTION_XML = 'vnd.yang.collection+xml'
MT_YANG_DATA_XML  = MT_BASE + '+xml'
MT_YANG_DATA_JSON = MT_BASE + '+json'

# HTTP response codes
HTTP_RESP_200_OK         = 200
HTTP_RESP_201_CREATE     = 201
HTTP_RESP_204_NO_CONTENT = 204
HTTP_RESP_404_NOT_FOUND  = 404


######################################################################
#  utility functions
######################################################################
def press_enter():
    raw_input('[Press ENTER to continue]')
    print()

def enable_logging():
    import logging
    import httplib

    logging.basicConfig(filename='rest.log', filemode='w')
    logging.getLogger().setLevel(logging.DEBUG)
    requests_log = logging.getLogger('requests.packages.urllib3')
    requests_log.setLevel(logging.DEBUG)
    requests_log.propagate = True

def print_json(json_str):
    print(json.dumps(json.loads(json_str), indent=4))
    print()

def remove_namespaces(r):
    """Remove all namespace declarations using XSL transform."""

    # http://wiki.tei-c.org/index.php/Remove-Namespaces.xsl
    xslt = '''<xsl:stylesheet version="1.0"
                              xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
              <xsl:output method="xml" indent="no"/>

              <xsl:template match="/|comment()|processing-instruction()">
                  <xsl:copy>
                      <xsl:apply-templates/>
                  </xsl:copy>
              </xsl:template>

              <xsl:template match="*">
                  <xsl:element name="{local-name()}">
                    <xsl:apply-templates select="@*|node()"/>
                  </xsl:element>
              </xsl:template>

              <xsl:template match="@*">
                  <xsl:attribute name="{local-name()}">
                    <xsl:value-of select="."/>
                  </xsl:attribute>
              </xsl:template>
          </xsl:stylesheet>'''

    from lxml import etree
    from io import BytesIO

    xslt_doc = etree.parse(BytesIO(xslt))
    transform = etree.XSLT(xslt_doc)

    return etree.tostring(transform(etree.fromstring(r.text)))


######################################################################
#  Get of top-level resource using Request
#  examples.confd/rest/basic/README section 1
######################################################################
def get_top_level_w_request():
    print('GET of top-level resource as XML using Request\n')

    resp = requests.get(BASE_URL, auth=AUTH)
    print(resp.content)    # resp.content is bytes; resp.text is unicode string
    press_enter()

    print('GET of top-level resource as JSON using Request\n')

    resp = requests.get(BASE_URL,
                        headers={'Accept' : MT_YANG_DATA_JSON},
                        auth=AUTH)
    print_json(resp.content)
    press_enter()

######################################################################
#  Root resource discovery using Session
#  examples.confd/rest/basic/README section 1
######################################################################
def get_root_resource(session, json=False):
    print('Get root resource as ', end='')
    if json == True:
        print('JSON\n')
        session.headers.update({'Accept' : MT_RR + '+json'})
    else:
        print('XML\n')

    resp = session.get(RR_URL)

    # resp.content is bytes; resp.text is unicode string
    if json == True:
        print_json(resp.content)
        session.headers.update({'Accept' : MT_ANY})
    else:
        print(resp.content)

    press_enter()

######################################################################
#  Get of top-level resource using Session
#  examples.confd/rest/basic/README section 1
######################################################################
def get_top_level(session, json=False):
    print('Get of top-level resource as ', end='')
    if json == True:
        print('JSON\n')
        session.headers.update({'Accept' : MT_YANG_DATA_JSON})
    else:
        print('XML\n')

    resp = session.get(BASE_URL)

    if json == True:
        print_json(resp.content)
        session.headers.update({'Accept' : MT_ANY})
    else:
        print(resp.content)

    press_enter()

######################################################################
#  Get of Running config datastore
#  examples.confd/rest/basic/README section 2
######################################################################
def get_running(session, json=False):
    if json == True:
        session.headers.update({'Accept' : MT_YANG_DATA_JSON})

    print('Get of Running config datastore as ', end='')
    if json == True:
        print('JSON\n')
    else:
        print('XML\n')
    press_enter()

    resp = session.get(BASE_URL + '/data')

    if json == True:
        # bug in JSON output encoding (missing commas)
        #print_json(resp.content)
        print(resp.content)
    else:
        print(resp.content)

    press_enter()

    if json == True:
        session.headers.update({'Accept' : MT_ANY})

######################################################################
#  Get of Running config datastore with selectors
#  examples.confd/rest/basic/README section 3
######################################################################
def get_running_w_selector(session, json=False):
    if json == True:
        session.headers.update({'Accept' : MT_YANG_DATA_JSON})

    print('Get of Running config datastore as ', end='')
    if json ==True:
        print('JSON', end='')
    else:
        print('XML', end='')
    print(' with "depth=1" selector\n')

    resp = session.get(BASE_URL + '/data',
                       params={'depth' : '1'})

    if json == True:
        # bug in JSON output encoding (missing commas)
        #print_json(resp.content)
        print(resp.content)
    else:
        print(resp.content)

    press_enter()

    print('Get of Running config datastore as ', end='')
    if json == True:
        print('JSON', end='')
    else:
        print('XML', end='')
    print(' with "depth=unbounded" selector\n')
    press_enter()

    resp = session.get(BASE_URL + '/data',
                       params={'depth' : 'unbounded'})

    if json == True:
        # bug in JSON output encoding (missing commas)
        #print_json(resp.content)
        print(resp.content)
    else:
        print(resp.content)

    press_enter()

    if json == True:
        session.headers.update({'Accept' : MT_ANY})

######################################################################
#  Delete part of the config and then re-create it
#  examples.confd/rest/basic/README sections 4 & 5
######################################################################
def delete_and_create_resource(session):
    # TODO: add JSON support

    # first get what we're going to delete so that we can re-add it later
    resp = session.get(BASE_URL + '/data/dhcp/subnet=10.254.239.0%2F27')
    saved_entry = remove_namespaces(resp)

    # delete
    print('Deleting data/dhcp/subnet=10.254.239.0%2F27...')

    resp = session.delete(BASE_URL + '/data/dhcp/subnet=10.254.239.0%2F27')

    if resp.status_code == HTTP_RESP_204_NO_CONTENT:
        print('Deletion successful\n')
    else:
        print('Deletion failed; code: {0}\n'.format(resp.status_code))

    print('Confirming deletion...')

    resp = session.get(BASE_URL + '/data/dhcp/subnet=10.254.239.0%2F27')

    if resp.status_code == HTTP_RESP_404_NOT_FOUND:
        print('Deletion confirmed\n')
    else:
        print('Deletion did not confirm; code: {0}\n'.format(resp.status_code))

    press_enter()

    # create
    print('Creating data/dhcp/subnet=10.254.239.0%2F27...')

    resp = session.post(BASE_URL + '/data/dhcp',
                        data=saved_entry)

    if resp.status_code == HTTP_RESP_201_CREATE:
        print('Creation successful\n')
    else:
        print('Creation failed; code: {0}\n'.format(resp.status_code))

    print('Confirming creation...')

    resp = session.get(BASE_URL + '/data/dhcp/subnet=10.254.239.0%2F27')

    if resp.status_code == HTTP_RESP_200_OK:
        print('Creation confirmed\n')
    else:
        print('Creation did not confirm; code: {0}\n'.format(resp.status_code))

    press_enter()

######################################################################
#  Modify an existing config item and then re-create it
#  examples.confd/rest/basic/README sections 6 & 9
######################################################################
def modify_resource(session):
    # TODO: add JSON support
    print('Get of data/dhcp/subnet=10.254.239.0%2F27/max-lease-time with '
          '"fields" query parameter:')

    resp = session.get(BASE_URL + '/data/dhcp/subnet=10.254.239.0%2F27',
                       params={'fields' : 'max-lease-time'})

    print(resp.content)

    # modify
    print('Modifying data/dhcp/subnet=10.254.239.0%2F27/max-lease-time...\n')

    new_max_lease_data = '''<subnet>
                                <max-lease-time>3333</max-lease-time>
                            </subnet>'''

    session.patch(BASE_URL + '/data/dhcp/subnet=10.254.239.0%2F27',
                  data=new_max_lease_data)

    # verify
    print('Get of data/dhcp/subnet=10.254.239.0%2F27/max-lease-time with '
          '"fields" query parameter:')

    resp = session.get(BASE_URL + '/data/dhcp/subnet=10.254.239.0%2F27',
                       params={'fields' : 'max-lease-time'})

    print(resp.content)
    press_enter()

    # use rollback operation to restore modified value
    # just apply rollback zero and assume no one has comitted in between...
    print('Using rollback facility to restore max-lease-time...\n')

    rollback_data = '<file>0</file>'

    resp = session.post(BASE_URL + '/data/_rollback',
                        data=rollback_data)

    print('Get of data/dhcp/subnet=10.254.239.0%2F27/max-lease-time with '
          '"fields" query parameter:')

    resp = session.get(BASE_URL + '/data/dhcp/subnet=10.254.239.0%2F27',
                       params={'fields' : 'max-lease-time'})

    print(resp.content)
    press_enter()

######################################################################
#  Replace an existing config item
#  examples.confd/rest/basic/README section 7
######################################################################
def replace_resource(session):
    # TODO: add JSON support
    # get existing data, then modify, then use saved existing data
    # to demonstrate replace
    resp = session.get(BASE_URL + '/data/dhcp/subnet=10.254.239.0%2F27')
    saved_data = resp.content

    # modify
    print('Modifying data/dhcp/subnet=10.254.239.0%2F27/max-lease-time...\n')

    new_max_lease_data = '''<subnet>
                                <max-lease-time>3333</max-lease-time>
                            </subnet>'''

    session.patch(BASE_URL + '/data/dhcp/subnet=10.254.239.0%2F27',
                  data=new_max_lease_data)

    print('Get of data/dhcp/subnet=10.254.239.0%2F27/max-lease-time with '
          '"fields" query parameter:')

    resp = session.get(BASE_URL + '/data/dhcp/subnet=10.254.239.0%2F27',
                       params={'fields' : 'max-lease-time'})

    print(resp.content)
    press_enter()

    print('Replacing data/dhcp/subnet=10.254.239.0%2F27/max-lease-time...\n')

    new_max_lease_data = '''<subnet>
                                <max-lease-time>3333</max-lease-time>
                            </subnet>'''

    session.put(BASE_URL + '/data/dhcp/subnet=10.254.239.0%2F27',
                data=saved_data)

    print('Get of data/dhcp/subnet=10.254.239.0%2F27/max-lease-time with '
          '"fields" query parameter:')

    resp = session.get(BASE_URL + '/data/dhcp/subnet=10.254.239.0%2F27',
                       params={'fields' : 'max-lease-time'})

    print(resp.content)
    press_enter()

######################################################################
#  Evaluate an action
#  examples.confd/rest/basic/README section 8
######################################################################
def evaluate_action(session):
    # TODO: add JSON support when available
    # TODO: add RPC test when available
    print('Triggering set-clock action...\n')

    action_input = '''<set-clock>
                          <clockSettings>1992-12-12T11:11:11</clockSettings>
                          <utc>true</utc>
                          <syncHardwareClock>true</syncHardwareClock>
                      </set-clock>'''

    resp = session.post(BASE_URL + '/data/dhcp/set-clock',
                        data = action_input)

    print('Action output parameters:')
    print(resp.content)
    press_enter()

######################################################################
#  main entry point
######################################################################
def run():
    print()

    enable_logging()

    # top-level get using Request
    #get_top_level_w_request()

    # Requests' Session class is a lot more convenient to work with than the
    # Request class.  Session will be used for the remainder of this example.

    # setup the global session
    session = requests.Session()
    session.auth = AUTH

    # top-level get using Session - README section 1
    get_root_resource(session)
    get_root_resource(session, json=True)

    # top-level get using Session - README section 1
    get_top_level(session)
    get_top_level(session, json=True)

    # get running datastore - README section 2
    get_running(session)
    get_running(session, json=True)

    # get running datastore with selectors - README section 3
    get_running_w_selector(session)
    get_running_w_selector(session, json=True)

    # delete and create a resource - README sections 4 & 5
    delete_and_create_resource(session)

    # modify an existing resource - README sections 6 & 9 (rollback)
    modify_resource(session)

    # replace an existing resource - README section 7
    replace_resource(session)

    # evaluate an action - README section 8
    evaluate_action(session)

######################################################################
if __name__ == '__main__':
    run()
