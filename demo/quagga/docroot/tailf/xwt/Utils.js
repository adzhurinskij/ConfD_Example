define('tailf/xwt/Utils', [
    'xwt/widget/layout/ProgressBall'
], function(ProgressBall) {

var _pb;


function m_startSpinner() {
    if (_pb) {
        return;
    }

    _pb = new xwt.widget.layout.ProgressBall({
        //imageMode : 'white',
        ballSize : 'extreme',
        targetId : 'contentArea',
        position : 'center',
        padding  : '10'
    });

    _pb.start();
}

function m_stopSpinner() {
    if (!_pb) {
        return;
    }

    _pb.stop();
    _pb = undefined;
}

return {
    startSpinner : m_startSpinner,
    stopSpinner  : m_stopSpinner
};

});
