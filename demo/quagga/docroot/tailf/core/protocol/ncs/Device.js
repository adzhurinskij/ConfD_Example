define('tailf/core/protocol/ncs/Device', [
    'jquery',
    '../../happy',
    '../../yang/ncs/Device',
    '../JsonRpc'
], function($, happy, Device, JsonRpc) {

/* Check if the devices-type is netconf
 * Returns a promise.
 */
function m_isNetconf(th, deviceName) {
    return happy(JsonRpc, 'exists', {
        th: th,
        path: Device.keypath(deviceName) + '/device-type/netconf'
    }, function(result) {
        return result.exists;
    });
}

return {
    // Convenience method(s)
    keypath   : Device.keypath,

    // The real stuff
    isNetconf : m_isNetconf
};
});
