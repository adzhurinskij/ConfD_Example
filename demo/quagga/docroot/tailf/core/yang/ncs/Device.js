define('tailf/core/yang/ncs/Device', [
    '../Keypath'
], function(Keypath) {


function m_keypath(deviceName) {
    return '/ncs:devices/device' + Keypath.listKeyIndex([deviceName]);
}

return {
    keypath : m_keypath
};
});
