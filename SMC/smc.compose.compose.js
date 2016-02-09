///////////////////////////////////////////////////////////////////////////////
//
//  @class      : ComposeEditorView
//  @comment    :
//  Handle the Editor mixin and provide functionality to create a new thread.
//  - the Shared/Editor/view_mixin contains all necessary logic to instance
//  TinyMCE, and manage the uploader utility
//  - we rely on this class to consume the editor mixin and perform Save/send
//  operations, unique to the Compose context.
//
//  Didyouknow : here, we're just firing up an informational modal view.
//
///////////////////////////////////////////////////////////////////////////////

define(function (require) {
    'use strict';

    // @mixin
    var _Dispatcher = require('dispatcher');
    var _Editor     = require('shared/editor/view_mixin');

    // @include
    var Marionette  = require('backbone.marionette');

    // @component
    var Template    = require('requireText!compose/templates/compose.html');
    var Confirm     = require('requireText!shared/templates/confirm.html');
    var Didyouknow  = require('requireText!shared/templates/modal_didyouknow.html');

    // CLASS //////////////////////////////////////////////////////////////////
    var ComposeEditorView =  Marionette.ItemView.extend({

        name        : 'ComposeEditorView',
        template    : _.template(Template),

        // INIT ///////////////////////////////////////////////////////////////

        initialize  : function(){

            this.$el.attr('data-el', this.name);
        },

        onAttach    : function(){

            // do deez tooltips
            this.$el.find('[data-action="tool-tip"]').mobileTooltip();

            // tell teh app that we opened
            this.dispatch( 'COMPOSE_OPENED', { type : this.model.get('audience').toLowerCase(), value : this.model.get('entity').BusinessDataValue } );
        },

        onDestroy   : function(){},

        // DOM EVENTS /////////////////////////////////////////////////////////

        events      : {
            'click  [data-action="change"]'  : 'onActionChange',
            'click  [data-action="modal-didyouknow"]' : 'onActionModalDidyouknow'
        },

        onActionChange : function(e){
            e.preventDefault();

            this.dispatch('COMPOSE_OPEN');
        },

        onActionModalDidyouknow : function(e){
            e.preventDefault();

            this.dispatch('MODAL_OPEN', {
                content : _.template(Didyouknow)
            });
        },

        // MIXIN EVENTS ///////////////////////////////////////////////////////

        onActionEditorCancel : function(e){
            e.preventDefault();

            var _this = this;
            var ui = this.model.get('ui');

            if ( !ui.isInit ){

                if( !ui.isSaved ){

                    this.dispatch( 'CONFIRM', {
                        content : _.template( Confirm, { confirm : 'EDITOR_LOST_CHANGES' } ),
                        no : {
                            text : 'Cancel',
                            callback : function(){}
                        },
                        yes : {

                            callback : function(){

                                _this._clearSafeRoute();

                                _this.dispatch('INBOX_OPEN');
                            }
                        }
                    });

                } else if ( !ui.isDisabled ) {

                    this.dispatch( 'CONFIRM', {
                        content : _.template( Confirm, { confirm : 'EDITOR_DISCARD_AND_CLOSE' } ),
                        no : {
                            text : 'Discard draft',
                            callback : function(){

                                _this._clearSafeRoute();

                                _this.dispatch('COMPOSE_DELETE');
                            }
                        },
                        yes : {
                            callback : function(){

                                _this._clearSafeRoute();

                                _this.dispatch('INBOX_OPEN');
                            }
                        }
                    });
                }

            } else {

                _this._clearSafeRoute();
                _this.dispatch('INBOX_OPEN');
            }

        },

        onActionEditorDelete : function(){

            var _this = this;

            this.dispatch( 'CONFIRM', {
                content : _.template( Confirm, { confirm : 'EDITOR_LOST_CHANGES' } ),
                no : {
                    text : 'Cancel',
                    callback : function(){}
                },
                yes : {

                    callback : function(){
                        _this._clearSafeRoute();

                        _this.dispatch('INBOX_OPEN');
                    }
                }
            });

        },

        onActionEditorSave: function(e,payload){

            this.dispatch('COMPOSE_SEND', payload.params);
        },

        onActionEditorSubmit : function( payload ){

            this.dispatch('COMPOSE_SEND', payload.params);
        }


    }).mixin([_Dispatcher, _Editor ]);

    return ComposeEditorView;
});
