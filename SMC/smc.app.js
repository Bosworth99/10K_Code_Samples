///////////////////////////////////////////////////////////////////////////////
//
//  @class : App
//  @comment : This is the core of the application; extending a marionette
//  Application.
//  - wire up all configuration filters
//  - bootstrp all Stores
//  - set up environmental vars
//  - finally, start() activates the backbone history.
//
///////////////////////////////////////////////////////////////////////////////

define(function (require) {
    'use strict';

    var shim        = require('marionette.mixin.shim');

    // r.js was missing these until called, here.
    // not entirely clear why - something to do with require via mixin.
    var advice      = require('backbone.advice');
    var mixin       = require('backbone.mixin');

    var tinyMCE     = require('tinyMCE');
    var tooltip     = require('mobileTooltip');

    // @mixins
    var _Dispatcher = require('dispatcher');

    // @includes
    var Marionette  = require('backbone.marionette');
    var Router      = require('router');

    // @utils
    var User        = require('user');
    var Config      = require('config');
    var Utility     = require('utility');

    // @modules
    var Controller  = require('controller/store');
    var Messages    = require('messages/store');
    var Compose     = require('compose/store');
    var Thread      = require('thread/store');
    var Nav         = require('nav/store');
    var Sidebar     = require('sidebar/store');
    var Footer      = require('footer/store');
    var Settings    = require('settings/store');
    var Confirm     = require('shared/confirm/store');
    var Loading     = require('shared/loading/store');

    var App =  Marionette.Application.extend({

        name : 'App',

        initialize : function(){

            this.config     = Config;
            this.utility    = Utility;

            // Start the router and the instantiation train
            this.router     = new Router(this);
            this.controller = new Controller(this);

            // wire up a mess of modules
            this.modules    = {
                nav      : Nav,
                sidebar  : Sidebar,
                footer   : Footer,
                messages : Messages,
                compose  : Compose,
                thread   : Thread,
                settings : Settings,
                confirm  : Confirm,
                loading  : Loading
            };

            $.ajaxSetup({ cache: false });

        },

        start: function () {
            //console.log('App::start User:%o Config:%o', User, Config );

            // request the profile environment var
            this.dispatch('SET_USER_PROFILE');
        },

        // DISPATCHER EVENTS //////////////////////////////////////////////////

        dispatcherEvents: {
            USER_PROFILE_SET  : 'onUserProfileSet'
        },

        onUserProfileSet : function(){
            Backbone.history.start();
        }

    }).mixin([_Dispatcher]);

    return App;
});
