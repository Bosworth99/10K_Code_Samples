///////////////////////////////////////////////////////////////////////////////
//
// @Class ModalView
// @Comment -
// The modal class is based on a marionette layoutView, and is meant to accept either
// a content string or a marionette itemView as the display content. We kick off its
// behavior with an event, passing in the config object with content as a property.
//
// Note on CSS: the goal, here, was to accept any and all content, and ensure it
// automatically centered itself on desktop/mobile. I went through a few revisions
// to make this work, but the right answer was probably a flexbox implementation (a
// path I didn't take).
//
// Currently, the modal is capable of rendering a view, which may have complicated
// logic/buttons/etc, but the modal, itself offers no extra functionality. The
// Confirm class was developed to extend this behavior, and should probably be rolled up
// into the modal, itself.
//
///////////////////////////////////////////////////////////////////////////////

define(function(require){
    'use strict';

    var _Dispatcher = require('dispatcher');
    var Marionette  = require('backbone.marionette');
    var Template    = require('requireText!shared/modal/template.html');

    // CLASS //////////////////////////////////////////////////////////////////

    var ModalView =  Marionette.LayoutView.extend({

        name : 'ModalView',

        template : _.template(Template),

        initialize: function(options){

            if (typeof options.payload.content === 'undefined'){
                throw new Error('Modal requires valid payload.content (eg. marionette ItemView) %o', options.payload);
            }

            // TODO - is this overwriting the existing options set? _.extend(options, this.options) instead?
            this.options = {
                parent    : '#body',                                // jquery selector, must exist in DOM
                content   : '<div>Oh Hai!</div>',                   // the modal content (including buttons)
                transition: 'fade',                                 // transition type ['default', 'fade']
                duration  : 150,                                    // transition duration
                wait      : false,                                  // if true, _showModal must be called
                autoClose : true,                                   // automatically generate close handlers

                background: null,                                   // css override
                opacity   : null,                                   // css override
                height    : null,                                   // css override
                width     : null,                                   // css override
                top       : null,                                   // force top position (override css centering)
                zIndex    : null                                    // css override
            };

            this.setOptions(options.payload);

            //console.log('ModalView::initialize payload:%o options:%o', options.payload, this.options);
        },

        activate : function(){

            this.styleModal();
            this.showModal();
            this.onRootViewResize();

            // prevent the page from scrolling during modal operation.
            $('body').css('overflow','hidden');
        },

        deactivate : function(){

            // re-enable scrolling, please.
            $('body').removeAttr('style');

            this.dispatch('MODAL_CLOSED');
        },

        regions :  {
            content : '#smc--modal-content'
        },

        onAttach : function(){

            this.$el.attr('data-el', this.name);

            this.$modal           = this.$el.find('.smc--modal');
            this.$modalBackground = this.$el.find('.smc--modal-background');
            this.$modalClose      = this.$el.find('.smc--modal-close');
            this.$modalOuter      = this.$el.find('.smc--modal-outer');
            this.$modalInner      = this.$el.find('.smc--modal-inner');

            // we want to be able to pass either a marionette view or a string
            if(typeof this.options.content.render !== 'undefined' ){

                // add a marionette view
                this.showChildView('content', this.options.content);
            } else {

                // append a string, jquery style
                this.$modalInner.append(this.options.content);
            }

            this.activate();

        },

        onDestroy : function(){},

        // DISPATCHER EVENTS //////////////////////////////////////////////

        dispatcherEvents : {
            MODAL_CLOSE       : 'onModalClose',
            ROOTVIEW_RESIZE   : 'onRootViewResize'
        },

        onModalClose : function(){

            this.closeModal();
        },

        onRootViewResize : function(){

            // a couple modals have a bunch of content and need to be scrollable. since we are doing this fancy
            // auto height and translate thing to center content, we don't actually have a known height to key off of

            this.$modalInner.removeAttr('style');

            this.$modalInner.height( this.$modalOuter.outerHeight() - 30 );

        },

        // EVENTS /////////////////////////////////////////////////////////
        events : function(){

            if( this.options.autoClose){
                return {
                    'click .smc--modal-background'  : 'closeModal',
                    'click .smc--modal-close'       : 'closeModal'
                };
            }
        },

        styleModal : function(){

            if(this.options.zIndex !== null){
                this.$modal.css({ 'z-index' : this.options.zIndex });
            }

            if(this.options.background !== null){
                this.$modalBackground.css({'background-color': this.options.background });
            }

            if(this.options.opacity !== null){
                this.$modalBackground.css({ opacity: this.options.opacity });
            }

            // here, if we have a top value, the content should set the height of the modal
            // else - explicity set the height at 350 (the default)

            if (this.options.top !== null){

                this.$modalOuter.css({ top : this.options.top, 'margin-top' : 0, 'margin-bottom' : 0, 'bottom' : 'auto' });

                this.$modalOuter.css( { height: 'auto' } );

            }

            if (this.options.height !== null){

                this.$modalOuter.css({ height : this.options.height });
            }

            if(this.options.width !== null){
                this.$modalOuter.css({ width : this.options.width });
            }

            if( !this.options.autoClose){
                this.$el.find('.smc--modal-close').hide();
            }

        },

        showModal : function(){
            switch(this.options.transition){
                case 'fade' :
                    this.$modal.hide().fadeIn(this.options.duration);

                    break;
                case 'default' :
                    this.$modal.show();

                    break;
            }
        },

        closeModal : function(){

            var _this = this;
            switch(this.options.transition){
                case 'fade' :
                    this.$modal.fadeOut(this.options.duration, function(){
                        _this.deactivate();
                    });

                    break;
                case 'default' :
                    this.$modal.hide('0',function(){
                        _this.deactivate();
                    });

                    break;
            }

        },

        // HELPERS ////////////////////////////////////////////////////////

        setOptions : function(options){
            if (typeof options !== 'undefined'){
                for(var key in options){
                    if (this.options.hasOwnProperty(key)){
                        this.options[key] = options[key];
                    }
                }
            } else {
                throw new Error('Modal setOptions called without valid options! %o', options);
            }
        }

    }).mixin([_Dispatcher]);


    return ModalView;
});
