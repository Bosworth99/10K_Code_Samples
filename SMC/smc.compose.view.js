///////////////////////////////////////////////////////////////////////////////
//
//  @class      : ComposeView
//  @comment    : view controller for the Compose module
//  - this is a layoutView, and manages one region
//  - this region gets swapped out based on the state of the store,
//  as the requisite identifiers and selections are made by the user
//  or by teh processing of a url
//
//  region updates are managed with triggered model events:
//  - 'render:audience' => views/audience.js
//  - 'render:entity'   => views/entity.js
//  - 'render:compose'  => views/compose.js
//
//  - We attempt to skip steps in the Store; if the user has exactly 1 (sub)entity
//  to communicate about, then query the service layer to pick the correct
//  identifiers, and skip forward to the Compose screen.
//  - Additionally, if a parsed URL contains a complete identifier set, perform
//  those same queries, and generate teh Compose screen
//
///////////////////////////////////////////////////////////////////////////////

define(function (require) {
    'use strict';

    // @mixin
    var _Dispatcher = require('dispatcher');

    // @include
    var Marionette   = require('backbone.marionette');

    // @component
    var Store        = require('compose/store');
    var AudienceView = require('compose/views/audience');
    var EntityView   = require('compose/views/entity');
    var EditorView   = require('compose/views/compose');
    
    var Template     = require('requireText!compose/template.html');

    // CLASS //////////////////////////////////////////////////////////////////
    var ComposeView  = Marionette.LayoutView.extend({

        name : 'ComposeView',

        className : 'row',

        template: _.template(Template),

        initialize : function(){
            this.model = Store;

            this.$el.attr('data-el', this.name);
        },

        regions :{
            layout : '#smc--compose-layout'
        },

        onAttach : function(){

            // this is redundant, as it gets called in the child-views
            this.dispatch('COMPOSE_OPENED');
        },

        onDestroy : function(){

            this.dispatch('COMPOSE_CLOSED');
        },

        // MODEL EVENTS ///////////////////////////////////////////////////////
        modelEvents: {
            'render:audience'   : 'onRenderAudience',
            'render:entity'     : 'onRenderEntity',
            'render:editor'     : 'onRenderEditor'
        },

        onRenderAudience: function () {
            if (this.getRegion('layout')) {
                this.showChildView('layout', new AudienceView({model : this.model}));
            }
        },

        onRenderEntity : function(){
            if (this.getRegion('layout')) {
                this.showChildView('layout', new EntityView({model : this.model}));
            }
        },

        onRenderEditor : function(){
            if (this.getRegion('layout')) {
                this.showChildView('layout', new EditorView({model : this.model}));
            }
        },

        // EVENTS /////////////////////////////////////////////////////////////

        events : {}


    }).mixin([_Dispatcher]);

    return ComposeView;

});
