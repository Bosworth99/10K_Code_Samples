///////////////////////////////////////////////////////////////////////////////
//
//  @class : Router
//  @comment :
//  The router is responsible for two separate sets of conditions
//  1. when history.start() is kicked off in app.js, the url is processed, and
//  any routing events are triggered, to be consumed in the related stores.
//  2. when a module view has been attached to the DOM, it emits a _OPENED
//  event, which the router is listening for.
//  - when captured, we update the backbone.history and update the URL
//
///////////////////////////////////////////////////////////////////////////////
define(function(require){
    'use strict';

    var _Dispatcher = require('dispatcher');

    var Backbone    = require('backbone');
    var Advice      = require('backbone.advice');
    Advice.addMixin(Backbone.Router);

    return Backbone.Router.extend({

        name : 'Router',

        initialize : function(app){
            this.app = app;
        },

        // in the case we hit a url directly, force an _OPEN action
        routes: {
            '': function () {

                // just go to this places
                this.dispatch('INBOX_OPEN');
            },

            'messages/:route': function (route) {
                this.dispatch(route.toUpperCase() + '_OPEN');
            },

            'messages/:route/:threadId': function (route, threadId) {
                this.dispatch('THREAD_OPEN', { view: route, threadId: threadId });
            },

            'compose(/:type)(/:value)' : function(type, value){
                //console.log('router #compose /type:%s /value:%s', type, value);

                var params = {};

                if ( type !== null /*&& typeof type !== 'undefined'*/ ){

                    params.type = type;
                }

                if ( value !== null /*&& typeof value !== 'undefined'*/ ){

                    params.value = value;
                }

                this.dispatch('COMPOSE_OPEN', params );
            },

            'settings' : function(){
                this.dispatch('SETTINGS_OPEN');
            },

            'help' : function(){
                this.dispatch('HELP_OPEN');
            }
        },

        // DISPATCHER EVENTS //////////////////////////////////////////////////

        // once a view has been completely generated, and is now present in the DOM, update the URL hash
        dispatcherEvents: {
            INBOX_OPENED    : 'onInboxOpened',
            DRAFTS_OPENED   : 'onDraftsOpened',
            TRASH_OPENED    : 'onTrashOpened',
            THREAD_OPENED   : 'onThreadOpened',
            COMPOSE_OPENED  : 'onComposeOpened',
            SETTINGS_OPENED : 'onSettingsOpened',
            HELP_OPENED     : 'onHelpOpened'
        },

        onInboxOpened: function() {
            Backbone.history.navigate('messages/inbox');
        },

        onDraftsOpened: function() {
            Backbone.history.navigate('messages/drafts');
        },

        onTrashOpened: function() {
            Backbone.history.navigate('messages/trash');
        },

        onThreadOpened: function(payload) {
            //Backbone.history.navigate('messages/' + payload.inboxType + '/' + payload.userId + '/' + payload.threadId);
            Backbone.history.navigate('messages/' + payload.inboxType + '/' + payload.threadId);
        },

        onComposeOpened: function(payload) {
            //console.log('Router::onComposeOpened payload : %o', payload);

            // #compose/BusinessDataType/BusniessDataValue
            // #compose/:type/:value
            // this could be null or undefined, handlle both

            var str = 'compose';

            if ( typeof payload !== 'undefined'){

                if ( payload.type !== null && typeof payload.type !== 'undefined' ){
                  str += '/'+payload.type;
                }

                if ( payload.value !== null && typeof payload.value !== 'undefined' ){
                  str += '/'+payload.value;
                }
            }

            Backbone.history.navigate(str);
        },

        onSettingsOpened : function(){
            Backbone.history.navigate('settings');
        },

        onHelpOpened : function(){
            Backbone.history.navigate('help');
        }

    }).mixin([ _Dispatcher]);
});
