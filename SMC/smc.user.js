
///////////////////////////////////////////////////////////////////////////////
//
//	@class : User
//  @comment
//  this is a late addition to the app. this runs initially, before app.start()
//  and acts as a CONST store after that.
//
///////////////////////////////////////////////////////////////////////////////

define(function(require){
	'use strict';

    var _Dispatcher = require('dispatcher');

    var SawUser     = window.SAW_USER;      // Default.aspx header vars
    var Utility     = require('utility');

    // @components
    var Error   = require('requireText!shared/templates/error.html');

    // CLASS //////////////////////////////////////////////////////////////////
    var UserStore = Backbone.Model.extend({

        name : 'UserStore',

        defaults : {

            SawEmail : SawUser.email,

            SawUserName : SawUser.userName,

            FirstName : '',

            LastName : '',

            Relations : '',

            Workpos : '',

            EntityTotalCount : 0
        },

        initialize: function() {
            //console.log('UserStore::initialize');
        },

        // DISPATCHER EVENTS //////////////////////////////////////////////////
        dispatcherEvents: {
            SET_USER_PROFILE   : 'onSetUserProfile'
        },

        onSetUserProfile : function(){

            var _this = this;

            // set up some basic identifiers for the user. we'll test these throughout the app lifecycle
            var action1 = {
                action : 'USER_PROFILE_REQUESTED',
                payload : {
                    params : {}
                }
            };

            // we need to know some basic stuff about how many entities the user
            // has access to.
            // - we make some conditional layout changes on settings and messages lists
            var action2 = {
                action : 'SETTINGS_LIST_REQUESTED',
                payload : {
                    params : [ JSON.stringify( {
                        MaxDisplay      : 0,
                        StartIndex      : 0,
                        SearchFilter    : null,
                        SortOrder       : 'asc',
                        SortColumn      : 'identifier',
                        CanSubscribe    : null,
                        ShowOptIn       : null
                    } ) ]
                }
            };


            this.waitFor( [ action1, action2 ])
                .done(function(data){
                    //console.log('UserStore::onSetUserProfile [success] data:%o', data );

                    if ( data[0].success && data[1].success){

                        _this.mapProfileData(data[0].content);

                        _this.mapEntityData(data[1].content);

                        // report back to the caller (app.js)
                        _this.dispatch('USER_PROFILE_SET');

                    } else {

                        _this.onSetUserProfileError( data[0] );
                    }

                })
                .fail(function(data){

                    _this._onSetUserProfileError( data[0] );
                });
        },

        onSetUserProfileError : function(){
            //console.log('%s::onSetUserProfileError %o', this.name, data);

            this.dispatch( 'CONFIRM', {
                content : _.template( Error, { error : 'USER_PROFILE', support : false } ),
                no : null,
                yes : {
                    text     : 'Continue',
                    callback : function(){

                        // navigate back to the profile
                        // TODO = is this right?
                        window.location.href = Utility.getEnvironmentURLs().baseUrl;
                    }
                }
            });

        },

        // DATA MAPPING //////////////////////////////////////////////////////

        mapProfileData : function(data){

            this.set( 'FirstName',   data.FirstName );
            this.set( 'LastName',    data.LastName );
            this.set( 'Relations',   data.Relations );
            this.set( 'Workpos',     data.Workpos );

        },

        mapEntityData : function(data){

            this.set('EntityTotalCount', data.TotalCount);
        }

    }).mixin([_Dispatcher]);


    // SINGLETON //////////////////////////////////////////////////////////////
    var instance;
    var getSingleton = function(){
        if (typeof instance === 'undefined'){
            instance = new UserStore();
        }
        return instance;
    };

    return getSingleton();

});
