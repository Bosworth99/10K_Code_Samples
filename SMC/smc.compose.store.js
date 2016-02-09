///////////////////////////////////////////////////////////////////////////////
//
//  @class      : ComposeStore
//  @comment    :
//  The Compose Store is the primary logic controller for teh "create a message" sequence.
//  It defines a multi-step process of :
//  - selecting an audience / entity-type to communicate about
//  - searching for, and selecting a specific sub-entity item (claim/account) to communicate about
//  - gather additional thread identifiers ( workpos )
//  - potentially subscribe to an enity, if the user is not yet subscribed
//  - finally, present an editor screen to develop thread content
//  -- subject | message body | attachments on the message
//
//  - we're consuming the shared editor mixin, here, and controlling the complicated
//  EditorViewMixin, which contains the majority of our procedure logic.
//  - for users with "few" available topics (subentities), we want to skip whatever steps we can to
//  simplify the procedure
//  - ensure that we can parse url parameters, and load up a known url path.
//
//  Note : we're handling ComposeView as a layoutView with three child views, representing
//  the three different steps; this is managed with triggered model events:
//  - 'render:audience' => views/audience.js
//  - 'render:entity'   => views/entity.js
//  - 'render:compose'  => views/compose.js
//
///////////////////////////////////////////////////////////////////////////////

define(function (require) {
    'use strict';

    // @mixin
    var _Dispatcher = require('dispatcher');
    var _Editor     = require('shared/editor/store_mixin');
    var _SafeRoute  = require('shared/safeRoute/store_mixin');

    // @include
    var Config      = require('config');
    var User        = require('user');
    var Utility     = require('utility');
    var Moment      = require('momentjs');

    // @component
    var RelationshipView    = require('compose/views/relationship');
    var SubscribeTemplate   = require('requireText!compose/templates/subscribe.html');
    var Error               = require('requireText!shared/templates/error.html');

    // CLASS //////////////////////////////////////////////////////////////////
    var ComposeStore =  Backbone.Model.extend({

        // do not change this. editor logic now tests against it.
        name : 'ComposeStore',

        // INIT ///////////////////////////////////////////////////////////////

        initialize: function() {
            //console.log('ComposeStore::initialize %o', this);

            this.set('Utility', Utility);
        },

        activate : function(){

            this.set('username', User.get('FirstName') + ' ' + User.get('LastName') );

            // inform the controller we're ready to render
            this.dispatch('COMPOSE_READY');
        },

        deactivate : function(){

            this.resetToDefaults();
        },

        defaults : {

            // audience props
            audience        : '',
            audienceType    : '',
            audienceCode    : '',

            // entities props
            isSearch        : '',
            entities        : [],
            trimCount       : 0,

            claimsCount     : 0,
            accountsCount   : 0,

            // entity search string
            searchTerm      : null,

            // track a bool for the initial render of teh entity selection screen
            entityInit      : true,

            // selected entity prop
            // this is actually a sub-entity in LNI nomenclature
            entity          : {},

            // this should be picked from the entity.Identifiers list
            relationship : {
                IdentifierType : null,
                IdentifierValue : null
            },

            // store the return thread data on save
            thread          : {
                request         : null,
                data            : null,
                threadId        : null
            },

            // handle a message object to test against in the editor
            message         : {
                data            : null,
                isDraft         : false,
                savedAt         : null,
                text            : null,
                messageRid      : null
            },

            // workpos props
            workpos : {
                FirstName   : '',
                LastName    : '',
                PhoneNumber : '',
                Description : '',
                Review      : '',
                WorkPos     : ''
            },

            // pick this from user.js
            username : ''

        },

        resetToDefaults : function(){

            this.set('searchTerm', null);

            this.set('thread', {
                request         : null,
                data            : null,
                threadId        : null
            });

            this.set('message', {
                data            : null,
                isDraft         : false,
                savedAt         : null,
                text            : null,
                messageRid      : null
            } );

            this.set('workpos', {
                FirstName   : '',
                LastName    : '',
                PhoneNumber : '',
                Description : '',
                Review      : '',
                WorkPos     : ''
            });

            this.set('entities', [] );
            this.set('entity', {} );
            this.set('entityInit', true);
            this.set('relationship', {});

            this.set('trimCount', 0);
            this.set('claimsCount', 0);
            this.set('accountsCount', 0);

        },

        // DISPATCHER EVENTS //////////////////////////////////////////////////

        dispatcherEvents: {

            COMPOSE_OPEN                : 'onComposeOpen',
            COMPOSE_CLOSED              : 'onComposeClosed',

            COMPOSE_SELECT_AUDIENCE     : 'onComposeAudienceSelected',
            COMPOSE_SEARCH_ENTITY       : 'onComposeEntitySearch',
            COMPOSE_SELECT_ENTITY       : 'onComposeEntitySelect',
            COMPOSE_SELECT_RELATION     : 'onComposeRelationSelected',
            COMPOSE_SAVE                : 'onComposeSend',
            COMPOSE_DELETE              : 'onComposeDelete',
            COMPOSE_SEND                : 'onComposeSend'

        },

        /*
            when we get a COMPOSE_OPEN event, we need to handle several conditions
            - if the type or value is set, assign audience props and request sub-entity data
                before rendering the editor
            - if the type / value are missing, we want to send the user through the selection view sequence
        */
        onComposeOpen : function( payload ){
            //console.log('ComposeStore::onComposeOpen payload : %o', payload );

            if ( !this.get('safeRoute').bool ){

                if (typeof this.get('safeRoute').callback === 'function'){
                    this.get('safeRoute').callback('COMPOSE_OPEN');
                }

                // no corn flakes for you.
                return;
            }

            // just be sure that everything is reset
            // - was having issues with some attrs maintaining through navigation
            this.resetToDefaults();

            // we may have parameters in the payload, and must process them
            // - if we don't, then check for a single entity condition and potentially fast forward steps
            if( typeof payload !== 'undefined'){

                // process all the payloads
                this.doParseURL(payload);

            } else {

                // the url params are not set, initiate the selection sequence
                this.doCheckForSingleEntity();
            }

        },

        onComposeClosed : function(){

            this.deactivate();
        },

        // SKIP TEH STEPS /////////////////////////////////////////////////////

        doParseURL : function(payload){

            var _this = this;

            // #compose/BusinessDataType/BusniessDataValue
            if ( typeof payload.type !== 'undefined' && typeof payload.value === 'undefined' ){

                // hit the activation method, this will render the module view,
                _this.activate();

                // here, we have the type, but not the value. hit the select entity screen
                this.onComposeAudienceSelected( { audience : payload.type } );

            } else if ( typeof payload.type !== 'undefined' && typeof payload.value !== 'undefined' ){

                // we have both the type and value. set the type attributes
                this.assignAudienceAttributes( payload.type.toUpperCase() );

                // assign the payload, and stringify it
                var request = [];
                request[0]  = '';  // sawguid
                request[1]  = JSON.stringify({ SearchText : payload.value } );
                request[2]  = this.get('audienceCode');

                var action  = (this.get('audienceCode') === '1')? 'COMPOSE_ENTITY_CLAIM_REQUESTED' : 'COMPOSE_ENTITY_ACCOUNT_REQUESTED';

                this.waitFor( [{ action: action, payload : { params : request } }] )
                    .done(function(data){

                        if (data[0].success){

                            // hit the activation method, this will render the module view,
                            _this.activate();

                            // here, data[0].content is the array
                            _this.set({ entities : data[0].content });

                            // call the final step before rendering the editor;
                            _this.onComposeEntitySelect({ audienceCode : payload.value });

                        } else {

                            _this.doComposeError('COMPOSE_GENERIC');
                        }
                    })
                    .fail(function(){

                        _this.doComposeError('COMPOSE_GENERIC');
                    });

            } else {

                // the url params are not set, initiate the selection sequence
                this.doCheckForSingleEntity();
            }

        },

        /*
            here, we're attempting to skip steps on the message compose sequence.
            - if we find that the user has access to exactly 1 claim or account,
            - then make some auto-selections and assign key identifiers based off the results

            NOTE
            - waitFor was producing unfortunate results when passing in the same action, twice.
            - had to make two COMPOSE_ENTITY actions to rectify
            - essentially, both promises resolved when the first event completed. bad beans, buddy.
        */
        doCheckForSingleEntity : function(){

            var _this = this;

            // request for Claims
            var request1 = [];
            request1[0]  = '';   // User.get('SawGuid') - this is now set during runtime, from session context in teh service layer
            request1[1]  = JSON.stringify({ SearchText : null } );
            request1[2]  = '1';  //audienceCode Claims

            var action1 = { action: 'COMPOSE_ENTITY_CLAIM_REQUESTED', payload : { params : request1 } };

            // request for Employer
            var request2 = [];
            request2[0]  = '';  //User.get('SawGuid')
            request2[1]  = JSON.stringify({ SearchText : null } );
            request2[2]  = '2';  //audienceCode Employer

            var action2 = { action: 'COMPOSE_ENTITY_ACCOUNT_REQUESTED', payload : { params : request2 } };

            // get both counts and do some comparison
            this.waitFor( [action1, action2] )
                .done(function(data){
                    //console.log('ComposeStore::doCheckForSingleEntity date : %o', data );

                    if ( data[0].success && data[1].success ){

                        // hit the activation method, this will render the module view
                        // - here, we've obtained teh counts and can either proceed with entity selection or skipping of steps
                        _this.activate();

                        // set the total counts for each, we'll use them later on the audience select screen, as well
                        _this.set('claimsCount', data[0].content.length);
                        _this.set('accountsCount', data[1].content.length);

                        // we're looking for exactly 1 claim or account
                        if (_this.get('claimsCount') + _this.get('accountsCount') === 1 ){

                            // assign the target data
                            var target;

                            // define the audience / entity attributes depending on counts
                            if ( _this.get('claimsCount') === 1 ){

                                _this.assignAudienceAttributes( 'CLAIMS' );

                                target = data[0];

                            } else {

                                _this.assignAudienceAttributes( 'EMPLOYER' );

                                target = data[1];
                            }

                            // assign entities;
                            // - this isn't strictly necessary?
                            _this.set( 'entities', target.content );

                            // assign the entity
                            // - we assume this to be a the zero index
                            _this.set( 'entity', _this.get('entities')[0] );

                            // map the entity attributes
                            _this.assignSubEntityAttributes( _this.get('entity') );

                            // check the subscription status and proceed with the rest of the data gathering
                            _this.doSelectRelationship();

                        } else {

                            // there are multiple entities to choose from, so just hit our initial screen
                            _this.trigger('render:audience');
                        }

                    } else {

                        _this.doComposeEntityError('COMPOSE_ENTITY');
                    }

                })
                .fail(function(){

                    _this.doComposeEntityError('COMPOSE_ENTITY');
                });

        },

        // SELECT AUDIENCE ////////////////////////////////////////////////////

        /*
            - here, we once implemented the IsSearchScreen method to determine subentity count.
            -- the logic returned wasn't vetting out, so we skipped it
            - instead of checking this, here, just perform a null search and count the results.
            - this has the same effect as the IsSearchScreen logic
        */
        onComposeAudienceSelected : function(payload){

            var _this = this;

            // user has selected an audience (claim or account)
            this.assignAudienceAttributes( payload.audience.toUpperCase() );

            // ok, we know the audience we want to communicate about, proceed with picking a sub-entity
            _this.doComposeEntityIsSearch();
        },

        // SEARCH ENTITY //////////////////////////////////////////////////////

        /*
            - perform a search of entities, keying on the search term or null
            - null will return a list of all available sub-entity topics
            - once established, we'll use these props to manage the subsequent entity search routine
        */
        doComposeEntityIsSearch : function(){
            //console.log('ComposeStore::doComposeEntityIsSearch');

            var _this = this;

            var request = [];
            request[0]  = ''; //User.get('SawGuid')
            request[1]  = JSON.stringify({ SearchText : null } );
            request[2]  = this.get('audienceCode');

            var action  = (this.get('audienceCode') === '1')? 'COMPOSE_ENTITY_CLAIM_REQUESTED' : 'COMPOSE_ENTITY_ACCOUNT_REQUESTED';

            this.waitFor( [{ action: action, payload : { params : request } }] )
                .done(function(data){

                    if ( data[0].success ){

                        // we don't want to show the full list of results.
                        var trimCount = (data[0].content.length > Config.entitiesTrimCount)? Config.entitiesTrimCount : data[0].content.length;

                        // set the counter for the template
                        _this.set( 'trimCount', trimCount );

                        // if ( init && isSearch ), then render the search box, but not the list of entities
                        if ( ( data[0].content.length > Config.entitiesTrimCount ) ){

                            // if there are more sub-entities than our trimCount, display a search box.
                            _this.set( 'isSearch', true);

                        } else {

                            // if there are fewer sub-entities than trimCount, no box for you!
                            _this.set( 'isSearch', false);

                            // so, just render whatever entities are available.
                            _this.set( 'entities', data[0].content );
                        }

                        // update the layout view with the new child instance
                        _this.trigger('render:entity');

                        // we need this set to true on the initial pass, for the "no results" message
                        // - so we're setting this after the above render.
                        _this.set('entityInit', false);

                    } else {

                        _this.doComposeError('COMPOSE_ENTITY');
                    }

                })
                .fail(function(){

                    _this.doComposeError('COMPOSE_ENTITY');
                });

        },

        /*
            - perform a search of entities, keying on the search term
            - present options for the user to select, proceeding on to step 3
        */
        onComposeEntitySearch : function(payload){
            //console.log('ComposeStore::onComposeEntitySearch payload:%o', payload);

            var _this = this;

            this.set('searchTerm', payload.searchTerm );

            // check for null / did the user clear the search?
            if ( payload.searchTerm === null ){

                // clear the entities list
                _this.set( 'entities', [] );

                // render the template, producing, we assume, only a search box.
                _this.trigger('render:entity');

            } else {

                // ok, so now we have a search to perform; do so, and render the results
                var request = [];
                request[0]  = ''; //User.get('SawGuid')
                request[1]  = JSON.stringify({ SearchText : this.get('searchTerm') } );
                request[2]  = this.get('audienceCode');  //BusinessDataValue

                var action  = (this.get('audienceCode') === '1')? 'COMPOSE_ENTITY_CLAIM_REQUESTED' : 'COMPOSE_ENTITY_ACCOUNT_REQUESTED';

                this.waitFor( [{ action: action, payload : { params : request } }] )
                    .done(function(data){
                        //console.log('ComposeStore::onComposeEntityReceived date[0] : %o', data );

                        if ( data[0].success ){

                            // populate the entities collection, as a result of a normal search
                            _this.set( 'entities', data[0].content );

                            // update the layout view with the new child instance
                            _this.trigger('render:entity');

                        } else {

                            _this.doComposeError('COMPOSE_ENTITY');
                        }

                    })
                    .fail(function(){

                        _this.doComposeError('COMPOSE_ENTITY');
                    });
            }

        },

        /*
            the user has clicked a sub/entity to communicate about,
            we need to pick teh data from the existing entities list, and then gather a
            few more identifiers, before proceeding to the compose screen / step 3
        */
        onComposeEntitySelect : function(payload){
            //console.log('ComposeStore::onComposeEntitySelect payload:%o', payload );

            // pick the selected entity data for the editor operation
            var entity = _.find( this.get('entities'), function(obj){
                return (obj.BusinessDataValue === payload.audienceCode);
            });

            // check to make sure we have a thing
            if ( typeof entity !== 'undefined' ){

                // since we built the clickable dom elements from the entities array, we assume this will exist
                this.assignSubEntityAttributes( entity );

                // check the subscription status
                this.doSelectRelationship();

            } else {

                // shouldn't get here.
                this.doComposeError('COMPOSE_GENERIC');
            }
        },

        /*
            if the entity has more than one identifier associated, we need force the user to make a selection
            - this relationship attr will be used during the send sequence to assign some stuff.
        */
        doSelectRelationship : function(){
            //console.log('ComposeStore::doSelectRelationship', this.get('entity'), this.get('relationship') );

            var entity      = this.get('entity');
            var identifiers = entity.Identifiers;

            // if we find more than one identifier, render a modal
            if (identifiers.length > 1){

                var options = {
                    content : new RelationshipView( { model : this } ),
                    autoclose : false
                };

                this.dispatch('MODAL_OPEN', options );

            } else {

                // normally the identifiers obj contains 1 identifier, at the [0] index. set it.
                this.set('relationship', identifiers[0] );

                // and continue on to the next checkpoint
                this.doEntitySubscription();
            }

        },

        /*
            handle a response by the Relationship modal, which we expect to
            contain a payload with the selected entity identifier.
            - find it and set it on teh relationship attr.
        */
        onComposeRelationSelected : function(payload){
            //console.log('ComposeStore::onComposeRelationSelected %o', payload );

            var _this           = this;
            var entity          = this.get('entity');
            var relationship    = _.findWhere( entity.Identifiers, { Name : payload.name } );

            if (typeof relationship !== 'undefined'){

                // set the relationship attr
                this.set('relationship', relationship );

                // note: modals are colliding, here, so include a short delay
                window.setTimeout(function(){

                    // now that we have a relationship selected, continue on to the next checkpoint
                    _this.doEntitySubscription();
                }, 350);

            } else {

                // bummer. return to start.
                this.doComposeError('COMPOSE_GENERIC');
            }
        },

        /*
            it will be possible to select a sub-entity that the user has not previously subscribed to
            - if we find the the COMPOSE_SUBSCRIBED_REQUESTED call returns false, trigger a confirm dialogue
            - at which point, the user may choose to proceed with subscription or cancel the operation.
        */
        doEntitySubscription : function(){

            var _this = this;

            var action       = 'COMPOSE_SUBSCRIBED_REQUESTED';
            var entity       = this.get('entity');
            var relationship = this.get('relationship');
            var audience     = this.get('audience');

            //console.log('ComposeStore::doEntitySubscription entity:%o relationship:%o audience:%o', entity, relationship, audience );

            // set some request props
            var request = [];
            request[0]  = relationship.IdentifierType;
            request[1]  = relationship.IdentifierValue;

            this.waitFor( [{ action: action, payload : { params : request } }] )
                .done(function(data){
                    //console.log('ComposeStore::doEntitySubscription .done %o request', data[0], request );

                    if(data[0].success){

                        // this method returns a boolean on the content prop
                        if( !data[0].content ){

                            var templateProps = {
                                entity          : entity,
                                relationship    : relationship,
                                audience        : audience,
                                Utility         : Utility
                            };

                            // the subscription check returned false, display a confirm dialogue to perform the subscribe.
                            _this.dispatch('CONFIRM', {
                                content : _.template( SubscribeTemplate, templateProps ),
                                no : {
                                    callback : function(){

                                        // return to the entity select screen; we might already be there..
                                        _this.dispatch('COMPOSE_OPEN', { type : audience });
                                    }
                                },
                                yes : {
                                    callback : function(){

                                        // could also dispatch the event from here.
                                        _this.doComposeSubscribe();
                                    }
                                },
                                modal :{
                                    width : 550,
                                    height: 'auto'
                                }
                            });

                        } else {

                            // here, we've found that the entity has been subscribe to, continue to the next checkpoint
                            _this.getWorkPos();
                        }

                    } else {

                        // Tha bads.
                        _this.doComposeError('COMPOSE_GENERIC');
                    }
                })
                .fail(function(){

                    // also, the bads.
                    _this.doComposeError('COMPOSE_GENERIC');
                });

        },

        /*
            here, we've found the COMPOSE_SUBSCRIBED query to return false, and the user
            has selected to continue with the subscription process
            - now, just call the method to perform a subscription from teh compose module
            - prior to this, we didn't have the right parameters for the Settings module to do this work, and
            the query, find, subscribe process that we were forced into was deemed too complicated. (it was)
        */
        doComposeSubscribe : function(){
            //console.log('ComposeStore::doComposeSubscribe %o', this.get('relationship') );

            var _this = this;

            var action       = 'COMPOSE_SUBSCRIBE_REQUESTED';
            var relationship = this.get('relationship');

            var request      = [];
            request[0]       = relationship.IdentifierValue;
            request[1]       = relationship.IdentifierType;

            this.waitFor( [{ action: action, payload : { params : request } }] )
                .done(function(data){
                    //console.log('ComposeStore::doComposeSubscribe .done %o', data[0] );

                    if(data[0].success){
                        // NOTE : data[0].content will be undefined, here.

                        // we've successfully subscribe the user to the sub-entity, continue to the next checkpoint
                        _this.getWorkPos();

                    } else {

                        // bad times
                        _this.doComposeError('COMPOSE_GENERIC');
                    }
                })
                .fail(function(){

                    // also, bad times
                    _this.doComposeError('COMPOSE_GENERIC');
                });

        },

        /*
            at this stage, we have all the necessary communication identifiers
             - now we need to present the work pos details for the compose template
        */
        getWorkPos : function(){

            var _this = this;
            var action;
            var action1;
            var request;
            var request1;

            // now that we have the thread data, get the workpos
            if ( this.get('audience') === 'CLAIMS' ){

                action   = 'WORKPOS_CLAIM_REQUESTED';
                request  = [this.get('entity').BusinessDataValue];

                action1  = 'WORKPOS_REVIEW_DATE_REQUESTED';
                request1 = [this.get('entity').BusinessDataValue];

                // we need to pick the workpos before rendering the compose.js template
                this.waitFor( [{ action: action, payload : { params : request } }, { action: action1, payload : { params : request1 } }] )
                    .done(function(data){

                        // smooth out the rough bits
                        _this.assignWorkPosDetails(data[0], data[1]);

                        // instantiate the compose view
                        _this.trigger('render:editor');
                    })
                    .fail(function(){

                        // assign some bunk values.
                        _this.assignWorkPosDetails( { FirstName : null, LastName : null }, false);

                        // instantiate the compose view
                        _this.trigger('render:editor');

                    });


            } else if( this.get('audience') === 'EMPLOYER'){

                action = 'WORKPOS_ACCOUNT_REQUESTED';
                request = [this.get('entity').BusinessDataValue];

                this.waitFor( [{ action: action, payload : { params : request } }] )
                    .done(function(data){

                        // make the datas moar better
                        _this.assignWorkPosDetails(data[0], false);

                        // instantiate the compose view
                        _this.trigger('render:editor');
                    })
                    .fail(function(){

                        // assign some bunk values.
                        _this.assignWorkPosDetails( { FirstName : null, LastName : null }, false);

                        // instantiate the compose view
                        _this.trigger('render:editor');

                    });
            }

        },

        // CREATE MESSAGE /////////////////////////////////////////////////////

        /*
            we have one method to handle both saving and sending of the thread
            - if we are on a save, we need to capture some critical data points
            to enable subsequent saves : threadId | messageRid
        */
        onComposeSend : function(payload){
            //console.log('ComposeStore::onComposeSend %o', payload);

            var _this        = this;

            var entity       = this.get('entity');
            var relationship = this.get('relationship');

            // do we have an existing saved thread? use it.
            var threadId     = (this.get('thread').threadId !== null)? this.get('thread').threadId : 0;
            var messageRid   = (this.get('message').messageRid !== null)? this.get('message').messageRid : 0;

            // pick from know defaults and user selected values to assemble a thread obj
            var thread       = {

                Title                       : payload.Subject,

                // User                     : User.get('SawGuid'),          // picking this from session context
                User                        : '',
                From                        : User.get('FirstName') + ' ' + User.get('LastName'),

                IsInternal                  : false,                        // this needs to exist, but is always false
                ActionRequired              : false,                        // this needs to exist, but is always false

                BusinessDataType            : this.get('audienceType'),     // [ClaimantId, AccountId]
                BusinessDataValue           : entity.BusinessDataValue,

                CorrespondenceRid           : threadId,
                CorrespondenceType          : this.get('audience'),
                CorrespondentBussinessName  : entity.BusinessName,
                CorrespondentFirstName      : entity.FirstName,
                CorrespondentLastName       : entity.LastName,

                EntityIdentifierType        : relationship.IdentifierType,
                EntityIdentifierValue       : relationship.IdentifierValue,
                LniRelationshipName         : relationship.EntityRelation,

                Messages                    : [],
                RecipientList               : []                            // this is apparently always empty (picked from context)
            };

            // assign message content
            var message = {
                IsDraft                     : payload.IsDraft,
                IsInternal                  : false,
                MessageRid                  : messageRid,
                Text                        : payload.MessageBody,
                IsResponseRequired          : payload.ResponseRequired
            };

            // associate the message with the thread prop
            thread.Messages.push(message);

            // store the reqeust object on the thread attr. extraneous?
            this.get('thread').request = thread;

            this.waitFor( [{ action: 'COMPOSE_MESSAGE_SAVE_REQUESTED', payload : { params : [ JSON.stringify(thread) ] } }] )
                .done(function(data){
                    //console.log('ComposeStore::onComposeSend .done data[0]:%o', data[0] );

                    if ( data[0].success ){

                        // process the results
                        _this.onComposeMessageSendReceived(data[0]);

                    } else {

                        var error = (payload.IsDraft)? 'COMPOSE_SAVE' : 'COMPOSE_SEND';
                        _this.doComposeMessageError( error );
                    }

                })
                .fail(function(){

                    var error = (payload.IsDraft)? 'COMPOSE_SAVE' : 'COMPOSE_SEND';
                    _this.doComposeMessageError( error );
                });

        },

        /*
            after the thread has saved, we need to take two actions based on the initiator type [ save, send ]

            if this is a "save" :
            - update button states,
            - render "saved time",
            - continue editing
         */
        onComposeMessageSendReceived : function(data){
            //console.log('ComposeStore::onComposeMessageSendReceived data : %o', data);

            // grab the existing attrs.
            var thread = this.get('thread');
            var message = this.get('message');

            // set message props as well. this is needed to process a message in draft status
            // - in the EditorViewMixin, we look for this prop and activate the editor / content if present
            var draft = _.findWhere( data.content._Messages, { _IsDraft : true} );

            // the response draft does not have the messageCreateDate set, so fake it.
            // this will be properly assigned in the thread view.
            var now = new Moment().format('h:mm:ss a');

            // store the return data on the thread attr if the request was a draft
            if ( typeof draft !== 'undefined' ){

                // store the threadId & messageRid of the now saved thread
                // we'll check against these during susequent saves

                thread.data         = data.content;
                thread.threadId     = data.content._Rid;

                message.data        = draft;
                message.messageRid  = draft._Rid;
                message.savedAt     = now;
                message.text        = draft._Text;
                message.isDraft     = true;

                // notify the thread was saved
                this.trigger('message:saved');

                // tell the user what happened!
                this.dispatch('TOASTER_OPEN',{ content : 'Message saved' } );

                // discreetly set the new attrs.
                // probably not necessary, but we'll sleep better a night.
                this.set('thread', thread);
                this.set('message', message);

            } else {

                // notify the message was sent
                this.trigger('message:sent');

                // tell the user
                this.dispatch('TOASTER_OPEN',{ content : 'Message sent', type : 'success'} );

                // now git ye the the inbox
                this.dispatch('INBOX_OPEN');

            }

        },

        /*
            if the user chooses to discard a draft from the confirm modal
            - call the delete thread service and return to inbox on success
        */
        onComposeDelete : function(){

            var _this = this;

            // define an action
            var action = 'DELETE_THREAD_REQUESTED';

            // store the current threadId
            var request = [];
            request[0] = JSON.stringify( [ this.get('thread').threadId ] );

            this.waitFor( [{ action : action, payload : { params : request } }] )
                .done(function(data){
                    //console.log('ComposeStore::onComposeDelete .done %o', data);

                    if ( data[0].success ){

                        // note : data[0].content is undefined, here.
                        _this.dispatch('TOASTER_OPEN',{ content : 'Message deleted', type : 'success'} );

                        // return to the inbox of choice,
                        _this.dispatch( 'INBOX_OPEN' );
                    } else {

                        _this.doComposeDeleteThreadError();
                    }
                })
                .fail(function(){

                    _this.doComposeDeleteThreadError();
                });

        },

        // DATA MAPPING ///////////////////////////////////////////////////////

        assignAudienceAttributes : function ( audience ) {

            // assign BusinessDataType / BusniessDataValue

            switch ( audience ){

                case 'CLAIMS' :

                    this.set({ audience             : audience });
                    this.set({ audienceType         : 'ClaimId' });
                    this.set({ audienceCode         : '1' });

                    break;

                case 'EMPLOYER' :

                    this.set({ audience             : audience });
                    this.set({ audienceType         : 'AccountId' });
                    this.set({ audienceCode         : '2' });

                    break;
            }
        },

        /*
            we need some extra properties for the subscription selection modal
        */
        assignSubEntityAttributes : function( data ){

            var entity = data;

            if (entity.BusinessDataType === 1 ){

                entity.type         = 'CLAIMS';
                entity.text         = Utility.mapBusinessTypeIdentfiers('claim');
                entity.identifier   = entity.FirstName + ' ' + entity.LastName;
                entity.value        = entity.BusinessDataValue;

            } else if ( entity.BusinessDataType === 2 ){

                entity.type         = 'EMPLOYER';
                entity.text         = Utility.mapBusinessTypeIdentfiers('account');
                entity.identifier   = entity.BusinessName;
                entity.value        = entity.BusinessDataValue;
            }

            // set the entity attribute for further consumption
            this.set('entity', entity);
        },

        // TODO : abstract this out to its own model, shared with the threadStore
        assignWorkPosDetails : function(data, review){

            // catch null, here, and force a string
            review = review || '';

            var content = data.content;
            var audience = this.get('audience');
            var workpos;

            if ( audience === 'CLAIMS' ){

                workpos = {
                    FirstName   : content.FirstName,
                    LastName    : content.LastName,
                    PhoneNumber : Utility.formatText('phone', content.PhoneNumber),
                    Description : 'Claim Manager',
                    Review      : (review.content !== null)? review.content : '',
                    WorkPos     : content.WorkPos
                };

                if ( ( content.FirstName === null && content.LastName === null ) || ( content.FirstName.trim() === '' && content.LastName.trim() === '' ) ){

                    workpos.Description = 'L&amp;I';
                    workpos.FirstName   = 'Claims ';
                    workpos.LastName    = 'Administration';
                    workpos.PhoneNumber = '800-547-8367';
                }

            } else if ( audience === 'EMPLOYER' ){

                workpos = {
                    FirstName   : content.FirstName,
                    LastName    : content.LastName,
                    PhoneNumber : Utility.formatText('phone', content.PhoneNumber),
                    Description : 'Account Manager',
                    Review      : '',           // accounts have no review date? i guess.
                    WorkPos     : content.WorkPos
                };

                if (content.PhoneNumber === '0'){
                    workpos.PhoneNumber = '360-902-4817';
                }

                if ( ( content.FirstName === null && content.LastName === null ) || ( content.FirstName.trim() === '' && content.LastName.trim() === '' ) ){

                    workpos.Description = 'L&amp;I';
                    workpos.FirstName   = 'Employer';
                    workpos.LastName    = 'Services';
                    workpos.PhoneNumber = '360-902-4817';
                }

            }

            // finally, set the workpos attribute.
            this.set('workpos', workpos );

            //console.log('ComposeStore::assignWorkPosDetails data:%o, review:%o, workpos:%o, audience:%o',data, review, this.get('workpos'), this.get('audience') );

        },

        // ERRORS /////////////////////////////////////////////////////////////

        doComposeError : function(error){

            var _this = this;

            this.dispatch( 'CONFIRM', {
                content : _.template( Error, { error : error, support : true } ),
                no : null,
                yes : {
                    text     : 'Ok',
                    callback : function(){

                        _this.dispatch('COMPOSE_OPEN');
                    }
                }
            });
        },

        doComposeEntityError : function(error){

            var _this = this;

            this.dispatch( 'CONFIRM', {
                content : _.template( Error, { error : error, support : true } ),
                no : null,
                yes : {
                    text     : 'Ok',
                    callback : function(){

                        _this.dispatch('INBOX_OPEN');
                    }
                }
            });
        },

        doComposeMessageError : function(error){

            var _this = this;

            this.dispatch( 'CONFIRM', {
                content : _.template( Error, { error : error, support : true } ),
                no : null,
                yes : {
                    text     : 'Ok',
                    callback : function(){

                        // in this case, we want to reset the editor and allow the user to try again.
                        _this.dispatch('EDITOR_UI_UPDATE', { isDisabled : false, isSaved : false } );
                    }
                }
            });
        },

        doComposeDeleteThreadError : function(){

            var _this = this;

            this.dispatch( 'CONFIRM', {
                content : _.template( Error, { error : 'COMPOSE_DELETE_THREAD', support : true } ),
                no : null,
                yes : {
                    text     : 'Ok',
                    callback : function(){

                        _this.dispatch('INBOX_OPEN');
                    }
                }
            });
        }

    }).mixin([_Dispatcher, _Editor, _SafeRoute ]);

    // SINGLETON //////////////////////////////////////////////////////////////
    var instance;
    var getSingleton = function(){
        if (typeof instance === 'undefined'){
            instance = new ComposeStore();
        }
        return instance;
    };

    return getSingleton();
});
