(function() {
    function login(user, password) {
        var deferred = $.Deferred();

        $.ajax({
            type: 'POST',
            url: '/jsonrpc/login',
            contentType : 'application/json; charset=utf-8',
            data: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'login',
                params: {
                    user: user,
                    passwd: password
                }
            }),
            dataType: 'json'
        }).done(function(reply, textStatus, jqXhr) {
            if (typeof reply.error !== 'undefined') {
                return deferred.reject(reply.error);
            }
            deferred.resolve(reply.result);
        }).fail(function(err) {
            deferred.reject(err);
        });

        return deferred.promise();
    }

    $(document).ready(function() {
        window.setTimeout(function() {
            $('#user').focus();
        }, 200);

        $('#login').submit(function(e) {
            var user = $('#user').val(),
                password = $('#password').val();

            login(user, password).done(function() {
                window.location.href = 'index.html#/';
            }).fail(function(err) {
                if (err && err.reason) {
                    window.alert(err.reason);
                }
            });
            e.preventDefault();
        });
    });
})();


