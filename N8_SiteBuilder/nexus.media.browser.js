///////////////////////////////////////////////////////////////////////////////
//
//  src     :
//  author  : bosworth
//  intent  : initiate and control Media browser
//  required: jquery v1.7+
//
//
//  _|_|_|      _|_|      _|_|
//  _|    _|  _|    _|  _|    _|
//  _|_|_|      _|_|_|    _|_|_|
//  _|    _|        _|        _|
//  _|_|_|    _|_|_|    _|_|_|
//
//
///////////////////////////////////////////////////////////////////////////////

var Nexus = window.Nexus || {};
Nexus.Media = window.Nexus.Media || {};
Nexus.Media.Data = window.Nexus.Media.Data || {};

///////////////////////////////////////////////////////////////////////////////
//
//   @class : Nexus.Media.Browser
//   @comment :
//      media browser instanitation and control. Accept input strings to control
//      the display of elements (stock, user, upload)
//      Browser gets planted in the dom, and is activate and deactivated, as needed
//
//  @return
//
///////////////////////////////////////////////////////////////////////////////
Nexus.Media.Browser = (function(){

    // classes
    var ROOT;
    var _ajax;

    var _stockMedia;
    var _userMedia;
    var _uploadMedia;
    var _uploader;

    // elements
    var _window;
    var _fixed;

    var _panel;
    var _tabs;
    var _panes;
    var _details;

    // vars
    var _activeTabs;
    var _options;
    var _cancelBtn;
    var _btnClose;
    var _currentView;
    var _isActive;

    var _isInit;
    var _resetCols;

    /* init +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/
    function init(args){
        //console.log('Nexus.Media.Browser Instantiated! args:%o', args);
        _options    = args;

        _ajax       = Nexus.Ajax.getDispatcher();

        _options = {
            'request'   : 'default',
            'stock'     : true,
            'stockdir'  : 'stock',
            'user'      : true,
            'upload'    : true,
            'format'    : false
        };

        processOptions(args);

        _window     = $(window);
        _fixed      = $('#fixed');
        _details    = Nexus.Media.Browser.Details;
        _activeTabs = [];

        _isActive   = false;
        _isInit     = true;
        _resetCols  = true;
    }

    /*
        @comment :
    */
    function activate(args){
        if (_isInit){
            assembleElements();
            addEventHandlers();
            initCSS();
            _isInit   = false;
        }

        _window.trigger('show-l3-mask');
        _panel.show();
        _isActive   = true;
        _resetCols  = true;

        processOptions(args);

        // on activation, reload the stock directory to match the format requested
        if (_options.stock) {
            _stockMedia.reloadDirectory( _options.stockdir );
        }
    }

    function deactivate(){
        _window.trigger('hide-l3-mask');
        Nexus.Module.EventDispatcher.trigger('browser-deactivate');
        _panel.hide();
        _isActive = false;
    }

    function assembleElements(){
        _details.init();
        //_fixed.append( _details.getElement() );

        _panel          = $( panel() );
        _fixed.append(_panel);

        _btnClose       = _panel.find('.close');
        _cancelBtn      = _panel.find('.action-bar .cancel');
        _tabs           = _panel.find('#browser-tabs');
        _panes          = _panel.find('#browser-tabs .panes');

        if (_options.stock){
            _stockMedia = new Nexus.Media.Browser.Stock(_panel, _options.stockdir);
            _activeTabs.push(_stockMedia);
            _currentView = _stockMedia.getView();
        }

        if (_options.user){
            _userMedia = new Nexus.Media.Browser.User(_panel);
            _activeTabs.push(_userMedia);
        }

        if (_options.upload){
            _uploadMedia = new Nexus.Media.Browser.Upload(_panel);
            _activeTabs.push(_uploadMedia);

            if(_options.user){
                addUploadHandlers();
            }
        }
    }

    function initCSS(){
        var hw = getInitialDimensions();
        _panel.css({'height' : hw[0] + 'px', 'width' : hw[1] + 'px'});

        centerPanel();
        onPanelResize();
        _panel.hide();
    }

    /* EVENTS ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/
    function addEventHandlers(){

        Nexus.Module.EventDispatcher.on({
            'do-reset-cols'     : function(){ _resetCols = true; },
            'do-select-document': function(e,args){
                if (_options.request === 'document' || _options.request === 'default'){
                    selectMedia( args );
                } else {
                    Nexus.Message.error('Please Choose an Image!');
                }
            },
            'do-select-image'   : function( e, args){
                if (_options.request === 'image' || _options.request === 'default'){
                    selectMedia( args );
                } else {
                    Nexus.Message.error('Please Choose a Document!');
                }
            }
        });

        _panel.on({
            'click' : function(){
                if (_resetCols){ setColumnRows(); }
                _details.activate($(this),_options);
            }
        }, '.thumb:not(.selected-thumb)');

        /*
            @comment = control activation  / deactivation of the panes, as required.
        */
        _tabs.tabs({
            activate: function( event, ui ) {
                switch ( ui.oldPanel.selector ) {
                    case "#stock-pane"  :
                        _stockMedia.deactivate();
                        break;
                    case '#user-pane'   :
                        _userMedia.deactivate();
                        break;
                    case '#upload-pane' :
                        _uploadMedia.deactivate();
                        break;
                }

                switch ( ui.newPanel.selector ) {
                    case "#stock-pane"  :
                        _stockMedia.activate();
                        _currentView = _stockMedia.getView();
                        break;
                    case '#user-pane'   :
                        _userMedia.activate();
                        _currentView = _stockMedia.getView();
                        break;
                    case '#upload-pane' :
                        _uploadMedia.activate();
                        _currentView = undefined;
                        break;
                }
            }
        });

        _cancelBtn.on({
            'click' : function(){
                deactivate();
            }
        });

        _btnClose.on({
            'click' : function(){
                deactivate();
            }
        });

        _window.on({
            resize : function(){
                onPanelResize();
                centerPanel();
            }
        });

        _panel.resizable({
            resize: function( event, ui ) {
                onPanelResize();
                centerPanel();
                _resetCols = true;
            },
            minHeight   : 300,
            minWidth    : 600
        });
    }

    function addUploadHandlers(){
        Nexus.Module.EventDispatcher.on({
            'add-new-user-media'  : function(e, data){
                _userMedia.updateCollection(data);
            }
        });
    }

    /* ACTIONS +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/
    function selectMedia(data){
        console.log('selecting media', data);

        var args = {};
        args.type   = data.type;
        args.file   = data.file;
        args.align  = data.align;
        switch ( data.media ) {
            case 'stock' :
                args.path   = '/'+Nexus.Utils.stripDomain(Nexus['vars']['assets'] + data.path);
                break;
            case 'user' :
                args.path   = '/'+Nexus.Utils.stripDomain(Nexus['vars']['uploads'] + data.path);
                break;
        }
        selectAndClose(args);
    }

    /*
    *   on select of media, trigger response and send data back to listener
    */
    function selectAndClose(args){
        Nexus.Module.EventDispatcher.trigger('media-selected', args);
        deactivate();
    }

    function processOptions(args){
        for (var key in args){
            _options[key] = args[key];
        }
    }

    /*
    *   not actually useing this, but it works so... maybe useful?
    */
    function setColumnRows(){
        var pos = {'row' : 0,'col' : 1};
        var nY   = 0;
        var oY   = 0;
        _currentView.find('.thumb').each(function(i,el){
            var t = $(el);
            nY = t.offset().top;
            if (nY > oY){
                pos.row++;
                pos.col = 1;
            }
            t.data('cls').setPosition({'row':pos.row,'col':pos.col});
            pos.col++;
            oY = nY;
        });
        _resetCols = false;
    }

    function destroy(){}

    /* Sizing ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/
    function getInitialDimensions(){
        var m = [300, 300];
        var wy = _window.height();
        var wx = _window.width();
        return [(wy - m[0]),( (wx - m[1]) > 1150)?1150:(wx - m[1]) ];
    }

    function centerPanel(){
        var top = Math.max(0, ((_window.height() - _panel.outerHeight()) / 2) );
        var left = Math.max(0, ((_window.width() - _panel.outerWidth()) / 2) );
        _panel.css({'top': (top-20)+'px','left':left+'px'});
    }

    function onPanelResize(){
        _panes.css('height', ( _panel.height() - 100 )+'px' );
    }

    /* ELEMENTS ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/
    function panel(){
        var str = '';
        str +=  '<div id="media-browser" class="browser-panel clearfix">';
        str +=      '<h2 class="panel-title">Media Browser</h2>';
        str +=      '<div class="close"><i class="iconic-x" style="font-size:32px"></i></div>';
        str +=      '<div id="browser-tabs" class="ui-tabs-container">';
        str +=         '<ul class="tabs">';
        str +=         '</ul>';
        str +=         '<div class="panes">';
        str +=         '</div>';
        str +=      '</div>';
        str +=      '<div class="action-bar">';
        str +=         '<div class="cancel btn"><i class="icon-remove-circle"></i> <span>Cancel</span></div>';
        str +=      '</div>';
        str +=  '</div>';
        return str;
    }

    /* HELPERS +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/

    return {
        init : function(args){
            ROOT = this;
            init(args || {});
        },
        activate : function(args){
            activate(args || {});
        },
        deactivate      : function(){ deactivate(); },
        getElement      : function(){ return _panel; },
        getStatus       : function(){ return _isActive; },
        save            : function(){ },
        destroy         : function(){ destroy(); },
        options         : _options
    };
})();

///////////////////////////////////////////////////////////////////////////////
//
//
///////////////////////////////////////////////////////////////////////////////
Nexus.Media.Browser.Stock = function(panel, dir){

    var ROOT = this;
    var _panel;
    var _pane;
    var _tree;
    var _view;
    var _loadmore;
    var _isActive;

    // collections
    var _stockDirectory;        // the stockdirectory (tree)
    var _collectionDirectory;   // our current dir (whats loaded now)
    var _currentCollection;     // array of thumbnail objects

    var _collectionIndex;       // for delayed loading, the current index of _currentCollection
    var _collectionFullyLoaded; // is the full collection loaded?

    var COLCOUNT = 20;          // how many thumbs to load at once

    /* INIT ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/
    function init(){
        _panel  = panel;

        if ( Nexus.Media.Data.stock !== undefined ){
            console.log('Nexus.Media.Browser.Stock.init( %o, %s)', Nexus.Media.Data.stock, dir );

            _stockDirectory         = dir;
            _collectionDirectory    = 'init';
            _currentCollection      = [];
            _collectionIndex        = 0;
            _collectionFullyLoaded  = false;

            _isActive               = false;

            assembleElements();
            addEventHandlers();
            initCSS();

        } else {
            Nexus.Message.error('Stock Media data was requested, but does not exist!');
        }
    }

    function assembleElements(){
        _panel.find('#browser-tabs .tabs').append( $( stockTab() ) );
        _panel.find('#browser-tabs .panes').append( $( stockPane() ) );

        _pane = _panel.find('#stock-pane');
        _tree = _panel.find('#stock-tree');
        _view = _panel.find('#stock-view');
        _loadmore = $(loadMore());

        renderDirectoryTree(_stockDirectory);
    }

    function addEventHandlers(){
        _tree.on({
            'click' : function(){
                if(!_isActive){ activate(); }  // ensure we're active

                var dir = $(this).attr('data-target');
                if (dir !== 'undefined'){
                    requestCollection( dir );
                    Nexus.Module.EventDispatcher.trigger('do-reset-cols');
                }
            }
        },'[data-action="load"]');

        _view.on({
            'click' :function(){
                if(!_collectionFullyLoaded){
                    loadPartialCollection();
                    Nexus.Module.EventDispatcher.trigger('do-reset-cols');
                }
            }
        }, '.load-more');

        Nexus.Media.Browser.TreeView.activateTree(_tree);
    }

    function removeEventHandlers(){
        _tree.off();
        _view.off();
    }

    function addThumbnailHandlers(){
        _view.on({
            'scroll.stock' : function(){
                updateCollectionView();
            }
        });

        _panel.on({
            'resize.stock' : function(){
                updateCollectionView();
            }
        });
    }

    function removeThumbnailHandlers(){
        _view.off('scroll.stock');
        _panel.off('resize.stock');
    }

    function initCSS(){}

    /* ACTIONS +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/
    function activate(){
        if(!_isActive){
            _isActive = true;
            addThumbnailHandlers();
        }
    }

    function deactivate(){
        _isActive = false;
        removeThumbnailHandlers();
    }

    // on Nexus.Media.Browser.acivate() reload the directory, if changed.
    function reloadDirectory(dir){
        if (_stockDirectory != dir){
            _stockDirectory = dir;
            clearCollection();
            renderDirectoryTree(dir);
            removeEventHandlers();
            addEventHandlers();
        }
    }

    /* DIRECTORY / TREE ++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/
    function renderDirectoryTree(dir){
        //console.log('Media.Broswer.Stock:renderDirectoryTree %s', dir);
        Nexus.Media.Browser.TreeView.clearTree( _tree );
        var directoryNode = filterDirectory(Nexus.Media.Data.stock, dir);
        if(directoryNode){
            Nexus.Media.Browser.TreeView.renderTree( directoryNode, _tree);
            //console.log('renderDirectoryTree found! %s', dir);
        } else {
            Nexus.Message.error('Could not obtain the requested Folder!');
        }
    }

    function filterDirectory(node, dir){
        var directory;
        for (var i = 0; i < node.length; i++) {
            try{
                if ( formatDirectoryString( node[i]['dir'] ) === dir){
                    directory = node[i]['subdir'];
                    break;
                }
            } catch(e){
                console.log(e);
            }

            if (!directory){
                try{
                    if (node[i]['subdir'].length > 0 ){
                        directory = filterDirectory( node[i]['subdir'], dir );
                    }
                } catch(e){
                    console.log(e);
                }
            }
        };
        return directory;
    }

    /* COLLECTIONS ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/
    function requestCollection(dir){
        //console.log('requesting collection', dir);
        if (_collectionDirectory !== dir){
            _collectionDirectory = dir;
            var collection = filterCollection(Nexus.Media.Data.stock, dir);
            if (collection){
                clearCollection();
                loadCollection(collection);
            } else {
                console.log('collection not found.');
            }
        }
    }

    // recurse through our data object and find the requested target obj.
    // how expensive is this? is there a better way to store the data node (maybe in the tree?)
    function filterCollection(node, dir){
        var collection;
        for (var i = 0; i < node.length; i++) {
            try{
                if (node[i]['dir'] === dir){
                    if (node[i]['files'].length > 0 ){
                        collection = node[i]['files'];
                        break;
                    }
                }
            } catch(e){
                console.log(e);
            }
            if (!collection){
                try{
                    if (node[i]['subdir'].length > 0 ){
                        collection = filterCollection( node[i]['subdir'], dir );
                    }
                } catch(e){
                    console.log(e);
                }
            }
        };
        return collection;
    }

    function loadCollection(collection){
        for (var i = 0; i < collection.length; i++) {
            var img = {};
            img.data = collection[i];
            img.parent = _view;
            img.index = i;
            var thumb = new Nexus.Media.Browser.Thumbnail();
            thumb.init(img);
            _currentCollection.push(thumb);
        }
        _view.append(_loadmore);
        loadPartialCollection();
    }

    function loadPartialCollection(){
        _loadmore.detach();
        var arr = [];
        arr[0] = _collectionIndex;
        if (_currentCollection.length < _collectionIndex + COLCOUNT){
            _collectionFullyLoaded = true;
            arr[1] = _currentCollection.length;
        } else {
            arr[1] = _collectionIndex + COLCOUNT;
        }
        for (var i = arr[0]; i < arr[1]; i++) {
            _currentCollection[i].activate();
            _collectionIndex++;
        }
        if (!_collectionFullyLoaded){
            _view.append(_loadmore);
        }
    }

    function clearCollection(){
        for (var i = 0; i < _currentCollection.length; i++) {
            _currentCollection[i].destroy();
        }
        _currentCollection.splice(0, _currentCollection.length);
        _collectionIndex = 0;
        _collectionFullyLoaded = false;
        _view.empty();
    }

    function updateCollectionView(){
        for (var i = 0; i < _currentCollection.length; i++) {
            _currentCollection[i].update();
        }
    }

    /* ELEMENTS ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/
    function stockTab(){
        return '<li class="tab stock"><a href="#stock-pane">Stock Images</a></li>';
    }

    function loadMore(){
        return '<span class="load-more btn btn-block">Load More</span>';
    }

    function stockPane(){
        var str = '';
        str +=  '<div id="stock-pane" class="pane clearfix">';
        str +=      '<div id="stock-tree" class="tree-container clearfix"></div>';
        str +=      '<div id="stock-view" class="view-container clearfix"><div style="text-align:center; margin:20px;">Please select a directory to view.</div></div>';
        str +=  '</div>';
        return str;
    }

    /* HELPERS ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/
    function formatDirectoryString(str){
        var arr = str.split("/");
        return arr[arr.length-1].toLowerCase();
    }


    // image_dir attr is now getting difined where applicable
    // use this as a secondary test?
    // or just remove

    function translateDirectoryName(str){
        var dir = 'stock';
        switch (str) {
            case 'minor_feature' :
                dir = 'minor_features';
                break;
            case 'minor_features' :
                dir = 'minor_features';
                break;
            case 'slides' :
                dir = 'impact';
                break;
            case 'impact' :
                dir = 'impact';
                break;
        }
        return dir;
    }

    init();
    return {
        activate        : function(){ activate();},
        deactivate      : function(){ deactivate();},
        getView         : function(){ return _view; },
        reloadDirectory : function(dir){
            //dir = translateDirectoryName(dir);
            reloadDirectory(dir);
        }
    };
};

///////////////////////////////////////////////////////////////////////////////
//
//
///////////////////////////////////////////////////////////////////////////////
Nexus.Media.Browser.User = function(panel){

    var ROOT = this;
    var _ajax;

    var _panel;
    var _view;
    var _tree;
    var _loadMore;

    var _hasData;
    var _isActive;

    var _collectionDirectory;
    var _currentCollection;
    var _collectionIndex;
    var _collectionFullyLoaded;

    var COLCOUNT = 20;

    /* INIT ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/
    function init(){
        //console.log('Nexus.Media.Browser.User::init()');

        _ajax                   = Nexus.Ajax.getDispatcher();
        _panel                  = panel;

        _hasData                = false;
        _isActive               = false;

        _collectionDirectory    = 'init';
        _currentCollection      = [];
        _collectionIndex        = 0;
        _collectionFullyLoaded  = false;

        assembleElements();

    }

    function assembleElements(){
        _panel.find('#browser-tabs .tabs').append( $( userTab() ) );
        _panel.find('#browser-tabs .panes').append( $( userPane() ) );
        _tree = _panel.find('#user-tree');
        _view = _panel.find('#user-view');
        _loadmore = $(loadMore());

        requestMediaData();
    }

    function requestMediaData(){
        _ajax.on({
            'user-media-recieved' : function(e, args){
                console.log('Nexus.Media.Browser.User::requestMediaData success:%o', args.response );
                if ( args.response.length > 0 ){

                    Nexus.Media.Data.user = args.response;
                    _hasData = true;
                    addEventHandlers();

                } else {
                   _view.append( noMediaMessage() );
                }
            }
        });
        Nexus.Ajax.getUserMedia();
    }

    function addEventHandlers(){
        _tree.on({
            'click' : function(){
                if(!_isActive){ activate(); }  // ensure we're active

                var type = $(this).data('target');
                if (type !== 'undefined'){
                    requestCollection( type );
                    Nexus.Module.EventDispatcher.trigger('do-reset-cols');
                }
            }
        },'[data-action="load"]');

        _view.on({
            'click' :function(){
                if(!_collectionFullyLoaded){
                    loadPartialCollection();
                    Nexus.Module.EventDispatcher.trigger('do-reset-cols');
                }
            }
        },'.load-more');

        Nexus.Media.Browser.TreeView.activateTree(_tree);
    }

    function addThumbnailHandlers(){
        _view.on({
            'scroll.user' : function(){
                updateCollectionView();
            }
        });

        _panel.on({
            'resize.user' : function(){
                updateCollectionView();
            }
        });
    }

    function removeThumbnailHandlers(){
        _view.off('scroll.user');
        _panel.off('resize.user');
    }

    /* ACTIONS ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/
    function activate(){
        if(!_isActive){
            _isActive = true;
            if (_hasData){
                addThumbnailHandlers();
                updateCollectionView();
            };
        }
    }

    function deactivate(){
        _isActive = false;
        removeThumbnailHandlers();
    }

    /* COLLECTIONS ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/

    function requestCollection(type){
        if (_collectionDirectory !== type){
            _collectionDirectory = type;
            var collection = filterCollection( Nexus.Media.Data.user, type);
            if (collection.length > 0){
                clearCollection();
                loadCollection(collection);
            } else {
                clearCollection();
                _view.append( noMediaMessage() );
                Nexus.Message.error('Directory is empty!');
            }
        }
    }

    function filterCollection(node, type){
        var collection = [];
        var reg = new RegExp(type,"gi");

        for (var i = 0; i < node.length; i++) {
            if (node[i]['filetype'].match(reg) !== null ){
                collection.push(node[i]);
            }
        }
        return collection;
    }

    function loadCollection(collection){
        for (var i = 0; i < collection.length; i++) {

            var item    = {};
            item.data   = collection[i];
            item.parent = _view;

            if (collection[i]['filetype'].match(/image/gi) !== null){
                var thumb = new Nexus.Media.Browser.Thumbnail();
                thumb.init(item);
                _currentCollection.push(thumb);

            } else {
                var doc = new Nexus.Media.Browser.Document();
                doc.init(item);
                _currentCollection.push(doc);
            }
        }
        _view.append(_loadmore);
        loadPartialCollection();
    }

    function loadPartialCollection(){
        _loadmore.detach();
        var arr = [];
        arr[0] = _collectionIndex;
        if (_currentCollection.length < _collectionIndex + COLCOUNT){
            _collectionFullyLoaded = true;
            arr[1] = _currentCollection.length;
        } else {
            arr[1] = _collectionIndex + COLCOUNT;
        }
        for (var i = arr[0]; i < arr[1]; i++) {
            _currentCollection[i].activate();
            _collectionIndex++;
        }
        if (!_collectionFullyLoaded){
            _view.append(_loadmore);
        }
    }

    function clearCollection(){
        for (var i = 0; i < _currentCollection.length; i++) {
            _currentCollection[i].destroy();
        }
        _currentCollection.splice(0, _currentCollection.length)
        _collectionIndex = 0;
        _collectionFullyLoaded = false;
        _view.empty();
    }

    function updateCollection(file){

        // if we are loading things into an empty collection
        if( !_hasData ){
            _hasData = true;
            Nexus.Media.Data.user = [];
            addEventHandlers();
        }

        var item              = {};
        item.data             = {};
        item.data.clientid    = Nexus.vars.id;
        item.data.filename    = file.name;
        item.data.filepath    = file.filepath.split('uploads/')[1]; // i've complicated this. reexamine and simplify.
        item.data.filetype    = file.type;
        item.data.url         = file.url;
        item.data.height      = file.height;
        item.data.size        = Nexus.Utils.formatFileSizeNumeric(file.size);
        item.data.title       = file.name;
        item.data.width       = file.width;
        item.parent           = _view;
        Nexus.Media.Data.user.push(item.data);

        if ( file.type.match(/image/gi) !== null ){

            if (_collectionDirectory === 'image') {
                var thumb = new Nexus.Media.Browser.Thumbnail();
                thumb.init(item);
                thumb.activate();
                _currentCollection.push(thumb);
            }

            Nexus.Message.success('New Image added<br>in My Media Tab!');

        } else {

            if (_collectionDirectory === 'pdf') {
                var doc = new Nexus.Media.Browser.Document();
                doc.init(item);
                doc.activate();
                _currentCollection.push(doc);
            }

            Nexus.Message.success('New Document added<br> in My Media Tab!');
        }

    }

    function updateCollectionView(){
        for (var i = 0; i < _currentCollection.length; i++) {
            _currentCollection[i].update();
        }
    }

    /* ELEMENTS ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/
    function userTab(){
        return '<li class="tab user"><a href="#user-pane">My Media</a></li>';
    }

    function userPane(){
        var str = '';
        str +=  '<div id="user-pane" class="pane clearfix">';
        str +=      '<div id="user-tree" class="tree-container clearfix">';
        str +=          '<ul class="tree">';
        str +=              '<li class="node"><span data-target="image" class="loader" data-action="load"><i class="state icon-folder-close"></i>Images</span></li>';
        str +=              '<li class="node"><span data-target="pdf" class="loader" data-action="load"><i class="state icon-folder-close"></i>Documents</span></li>';
        str +=          '</ul>';
        str +=      '</div>';
        str +=      '<div id="user-view" class="view-container clearfix"><div style="text-align:center; margin:20px;">Please select a directory to view.</div></div>';
        str +=  '</div>';
        return str;
    }

    function noMediaMessage(){
        return '<strong style="display:block; position:relative; margin:40px;">You have uploaded no Media.</strong>';
    }

    function loadMore(){
        return '<span class="load-more btn btn-block">Load More</span>';
    }

    init();
    return {
        activate            : function(){ activate(); },
        deactivate          : function(){ deactivate(); },
        getView             : function(){ return _view},
        updateCollection    : function(args){ updateCollection(args); },
        reloadCollection    : function(){}
    };
};

///////////////////////////////////////////////////////////////////////////////
//
//
///////////////////////////////////////////////////////////////////////////////
Nexus.Media.Browser.Upload = function(panel){

    var ROOT;
    var _ajax;
    var _uploader;
    var _pane;
    var _panel;

    var _isActive;

    /* INIT ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/
    function init(){
        //console.log('Nexus.Media.Browser.Upload::init()', Nexus.Media.Data.user );
        ROOT        = this;
        _ajax       = Nexus.Ajax.getDispatcher();
        _panel      = panel;
        _isActive   = false;

        assembleElements();
    }

    function assembleElements(){
        _panel.find('#browser-tabs .tabs').append( $( uploadTab() ) );
        _panel.find('#browser-tabs .panes').append( $( uploadPane() ) );
        _pane = _panel.find('#upload-pane');
        assembleUploader();
    }

    function assembleUploader(){
        _ajax.on({
            'upload-structure-recieved' :function(event, markup){
                _ajax.off('upload-structure-recieved');
                _pane.append( markup );

                var mediaAddContainer = _panel.find('#media-add-container');
                mediaAddContainer.addClass('browser-form');

                _uploader = new Nexus.Media.Uploader();

                addEventHandlers();
                initCSS();
            }
        });
        Nexus.Ajax.getStructureRender('system/form/Add_Media','upload-structure-recieved');
    }

    function addEventHandlers(){
        Nexus.Module.EventDispatcher.on({
            'upload-media-success'  : function(e, data){
                console.log('upload-media-success: %o', data);
                Nexus.Module.EventDispatcher.trigger('add-new-user-media', data);
            }
        });
    }

    function initCSS(){}

    /* ACTIONS ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/
    function activate(){_isActive = true; }
    function deactivate(){_isActive = false; }

    /* ELEMENTS ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/
    function uploadTab(){
        return '<li class="tab upload"><a href="#upload-pane">Upload Media</a></li>';
    }

    function uploadPane(){
        return '<div id="upload-pane" class="pane clearfix"></div>';
    }

    init();
    return {
        activate        : function(){ activate(); },
        deactivate      : function(){ deactivate(); }
    };
};

///////////////////////////////////////////////////////////////////////////////
//
//
///////////////////////////////////////////////////////////////////////////////
Nexus.Media.Browser.Document = function(){

    var ROOT;
    var _id;
    var _data;

    var _doc;
    var _select;
    var _parent;
    var _container;

    var _isLoaded;
    var _isActive;

    /* INIT ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/
    function init(obj){
        //console.log('Nexus.Media.Browser.Document::init() %o', obj);
        _id         = 'media-doc-'+Nexus.Utils.getRandomNumber();
        _data       = obj.data;
        _parent     = obj.parent;
    }

    function assembleElements(){
        _doc        = $(document());
        _parent.append(_doc);
        _select     = _doc.find('.doc-select');
        _isLoaded   = true;
    }

    function addEventHandlers(){
        _select.on({
            'click' : function(){
                Nexus.Module.EventDispatcher.trigger('do-select-document', {
                    'type' : _data.filetype,
                    'file' : _data.title,
                    'align': 'none',
                    'media': 'user',
                    'path' : _data.filepath
                } );
            }
        });
    }


    /* ACTIONS ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/
    function activate(){
        _isActive = true;
        assembleElements();
        addEventHandlers();
    }

    function deactivate(){
        _isActive = false;
    }

    function destroy(){
        if (_isLoaded){
            _doc.remove();
        }
        delete ROOT;
    };

    /* ELEMENTS ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/
    function document(){
        var str = '';
        str +=  '<div id="'+_id+'" class="doc" data-media="user" data-type="'+_data.filetype+'" data-file="'+_data.title+'" data-path="'+_data.filepath+'" data-size="'+_data.size+'kb" >';
        str +=      '<div class="thumb-wrapper"><img src="'+Nexus.vars.images+'icons/pdf-icon.png" /></div>';
        //str +=      '<a class="link" href="'+Nexus.vars.uploads+_data.filepath+_data.filename+'" target="_blank"><h3 class="title">'+_data.title+'</h3></a>';
        str +=      '<h3 class="title">'+_data.title+'</h3>';
        str +=      '<span> Size: <strong>'+_data.size+' kb</strong></span>';
        str +=      '<span class="doc-select btn"><i class="icon-ok"></i> Select</span>';
        str +=  '</div>';
        return str;
    }

    /* HELPERS ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/
    return {
        init        : function(obj){
            ROOT = this;
            init(obj);
        },
        activate    : function(){ activate(); },
        deactivate  : function(){ deactivate(); },
        destroy     : function(){ destroy(); }
    };
};

///////////////////////////////////////////////////////////////////////////////
//
//
///////////////////////////////////////////////////////////////////////////////
Nexus.Media.Browser.Thumbnail = function(){

    var ROOT;
    var _id;
    var _data;

    var _parent;
    var _container;
    var _img;
    var _src;

    var _isActive;
    var _isSelected;
    var _isLoaded;
    var _isStock;

    var _position;

    //container'
    var off = 26;           // container padding + margin
    var HxW = [120 - off, 180 - off];    //container size

    /* INIT ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/
    function init(obj){
        console.log('Nexus.Media.Browser.Thumbnail::init() %o', obj);

        _id         = 'media-thumb-'+Nexus.Utils.getRandomNumber();
        _data       = obj.data;
        _parent     = obj.parent;
        _isStock    = (_data['clientid'] === '0')?true:false;
        _isActive   = false;
        _isLoaded   = false;

        _position   = {
            'row'    : 0,
            'col'    : 0
        };

        if (_isStock){
            _src = Nexus['vars']['assets']+_data.filepath +_data.filename;
        } else {

            if (_data.url){
                _src = _data.url;
            } else {
                _src    = Nexus['vars']['uploads']+_data.filepath+_data.filename;
                //_src = _data.filepath+_data.filename;
            }
        }

        //console.log('Thumbnail::init _src', _src);
    }

    function assembleElements(){
        if (_isStock){
            _container = $( stockContainer() );
        } else {
            _container = $( userContainer() );
        }
        _container.css({
            'height' : HxW[0] +'px',
            'width'  : HxW[1] +'px'
        });
        _parent.append(_container);

        // attach this class to our container el
        jQuery.data(_container[0],'cls', ROOT);
    }

    /* ACTIONS ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/
    function activate(){
        _isActive = true;
        assembleElements();
        loadImage();
    }

    function loadImage(){
        if( isVisible() ){
            _img = $( new Image() );
            _img.attr('src', _src )
                .load( function(){
                    _img.appendTo(_container);
                    var h = _img.height();
                    var top = (h !== 0)? (HxW[0] - h) / 2: 0 ;
                    _img.css({'top' : top+'px' });
                    _img.hide().fadeIn(350);

                });
            _isLoaded = true;
        }
    }

    function deactivate(){}
    function select(){}
    function deselect(){}

    function destroy(){
        if(!_isLoaded && _isActive){
            _container.remove();
        }
        delete ROOT;
    }

    /* ELEMENTS ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/
    function stockContainer(){
        return '<div id="'+_id+'" class="thumb" data-type="'+_data.filetype+'" data-media="stock" data-file="'+_data.filename+'" data-path="'+_data.filepath+'"  data-dim="'+_data.height+' x '+_data.width +'" data-size="'+_data.size+'kb" ></div>';
    }

    function userContainer(){
        return '<div id="'+_id+'" class="thumb" data-type="'+_data.filetype+'" data-media="user" data-file="'+_data.title+'" data-path="'+_data.filepath+'" data-dim="'+_data.height+' x '+_data.width +'" data-size="'+_data.size+'kb" ></div>';
    }

    function thumbActions(){
        var str = '';
        str += '<div class="thumb-actions">';
        str +=      '<div class="details">';
        str +=          '<h3 class="title">'+_data.title+'</h3>';
        str +=          '<span class="thumb-select btn"><i class="icon-ok"></i> Select</span>';
        str +=      '</div>';
        str +=      '<span class="backfill"></span>';
        str += '</div>';
        return str;
    }

    /* HELPERS ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/

    function isVisible() {
        var pos = _container.position();
        return (pos.top + HxW[0] > 0 && pos.top < _parent.height() );
    }

    // how might we want to store these object?
    // do we chache them during the page lifecyle?
    // do we delete them once a new collection has been requested?
    // creation / deletion on each collection view seems uncessarily expensive.

    return {
        init        : function(obj){
            ROOT = this;
            init(obj);
        },
        update      : function(){
            if(!_isLoaded && _isActive){
                loadImage();
            }
        },
        activate    : function(){ activate(); },
        select      : function(){ select(); },
        setPosition : function(args){ _position = args; },
        getPosition : function(){ return _position;},
        deactivate  : function(){ deactivate(); },
        deselect    : function(){ deselect(); },
        destroy     : function(){ destroy(); }
    };
};

///////////////////////////////////////////////////////////////////////////////
//
//
//
///////////////////////////////////////////////////////////////////////////////
Nexus.Media.Browser.Details = (function(){

    var ROOT;
    var _panel;
    var _data;
    var _window;
    var _container;

    var _img;
    var _file;
    var _size;
    var _dim;
    var _align;

    var _format;

    var _btnSelect;
    var _btnClose;

    function init(){
        _window = $(window);
        _data   = {};

        assembleElements();
        addEventHandlers();
        initCSS();
    }

    function assembleElements(){
        _panel      = $( panel() );
        _img        = _panel.find('img');
        _file       = _panel.find('.file');
        _size       = _panel.find('.size');
        _dim        = _panel.find('.dimensions');

        _format     = _panel.find('.format');

        _btnSelect  = _panel.find('.select');
        _btnClose   = _panel.find('#details-close');

        $('#fixed').append(_panel);
    }

    function addEventHandlers(){
        _btnSelect.on({
            'click' : function(){
                Nexus.Module.EventDispatcher.trigger('do-select-image', _data);
                deactivate();
            }
        });

        _btnClose.on({
            'click' : function(){
                deactivate();
            }
        });

        _panel.find('select').on({
            'change' : function(){
                _align = $(this).val();
                _data.align = _align;
            }
        });

        _panel.draggable({
            'scroll'        : false,
            'containment'   : 'parent'
        });
    }

    function initCSS(){
        _panel.hide();
    }

    function activate(el,options){
        _data.file    = el.attr('data-file');
        _data.path    = el.attr('data-path');
        _data.thumb   = el.attr('data-thumb');
        _data.dim     = el.attr('data-dim');
        _data.size    = el.attr('data-size');
        _data.type    = el.attr('data-type');
        _data.media   = el.attr('data-media');
        _data.offset  = el.offset();
        _data.align   = 'left';

        if (options.format){
            _format.show();
        } else {
            _format.hide();
        }

        if ( _data.media === 'stock'){
            _img.attr('src', Nexus.vars.assets+_data.path+_data.file);
        } else {
            _img.attr('src', Nexus.vars.uploads+_data.path+_data.file);
        }
        _img.hide();
        window.setTimeout(function(){centerImage();}, 100);

        _file.text(_data.file);
        _size.text(_data.size);
        _dim.text(_data.dim);

        locatePanel(el);

        _panel.fadeIn('fast');
    }


    function locatePanel(el){
        _data.top = (_data.offset.top - _window.scrollTop()) - 105;
        _data.left = _data.offset.left - ((_panel.outerWidth() - el.outerWidth()) /2);

        _panel.css({'top':_data.top+'px','left': _data.left+'px'});
    }

    function centerImage(){
        var cH = _panel.find('.details-container').outerHeight(false);
        var iH = _img.height();
        _img.css({'margin-top' : ((cH - iH) / 2) + 'px'});
        _img.fadeIn(150);
    }

    function deactivate(){
        _panel.hide();
    }

    function panel(){
        var str = '';
        str +=      '<div id="media-thumb-details" class="thumb-details">';
        str +=          '<div class="image-container">';
        str +=              '<img src="" />';
        str +=          '</div>';
        str +=          '<div class="details-container">';
        str +=              '<div style="padding:20px;"> File Name:<strong class="file"></strong>';
        str +=                  'Dimensions:<strong class="dimensions"></strong>';
        str +=                  'Size (kb):<strong class="size"></strong>';
        str +=              '</div>';
        str +=              '<div class="format">';
        str +=                  '<div id="align">';
        str +=                      '<label style="margin-left:20px;">Align</label>';
        str +=                      '<select style="margin-left:20px; width:85px;">';
        str +=                          '<option value="left">Left</option>';
        str +=                          '<option value="right">Right</option>';
        str +=                          '<option value="center">Centered</option>';
        str +=                          '<option value="none">None</option>';
        str +=                      '</select>';
        str +=                  '</div>';
        str+=               '</div>';
        str +=              '<span id="details-select" class="select btn btn-primary"><i class="icon-check icon-white"></i> Select</span>';
        str +=          '</div>';
        str +=          '<span id="details-close" class="iconic-x"></span>';
        str +=      '</div>';
        return str;
    }

    return {
        init : function(){
            ROOT = this;
            init();
        },
        activate : function(el,options){
            activate(el,options);
        },
        deactivate : function(){
            deactivate();
        }
    };
})();

///////////////////////////////////////////////////////////////////////////////
//
//  @comment : create a method to create and destroy a tree view of directories
//             - used in the media browser feature.
//
///////////////////////////////////////////////////////////////////////////////
Nexus.Media.Browser.TreeView = (function(){

    function render(obj, target){
        var tree = $('<ul class="tree"></ul>');
        target.append(tree);
        renderBranch(obj, tree);
    }

    function renderBranch(node, t){
        for (var i = 0; i < node.length; i++) {
            //console.log('rendering',node[i]);
            var li = $( renderLeaf(node[i]) );
            t.append(li);
            try {
                if ( node[i]['files'].length > 0 ){
                    li.find('[data-target]').addClass('loader').attr('data-action','load');
                }
            } catch(e){
                console.log(e);
            }
            try {
                if( node[i]['subdir'].length > 0 ){
                    var ul = $('<ul class="branch closed"></ul>');
                    li.append(ul);
                    li.prepend('<i class="plus">+</i>')
                    li.find('[data-target]').addClass('parent').attr('data-action', 'open');
                    renderBranch(node[i]['subdir'], ul);
                }
            } catch(e){
                console.log(e);
            }
        }
    }

    function renderLeaf(obj){
        var title = (obj.title !== undefined)? obj.title: formatDirTitle(obj.dir);
        var str = '';
        switch (obj.type) {
            case 'folder' :
                str += '<li class="node"><span data-target="'+obj.dir+'"><i class="state icon-folder-close"></i>'+title+'</span></li>';
                break;
            case 'image' :
                str += '<li class="node"><span class="image"><i class="icon-picture"></i> '+obj.file+'</span></li>';
                break;
        }
        return str;
    }

    function activate(target){

        target.on({
            'click' :function(){
                target.find('.current .icon-folder-open').removeClass('icon-folder-open').addClass('icon-folder-close');
                target.find('.current').removeClass('current');

                var t = $(this);
                t.addClass('current');
                t.find('.icon-folder-close').removeClass('icon-folder-close').addClass('icon-folder-open');
            }
        }, '[data-action="load"]');

        target.on({
            'click' :function(){
                // open current
                var t = $(this);
                t.attr('data-action', 'close');
                t.find('icon-folder-close').removeClass('icon-folder-close').addClass('icon-folder-open');
                t.siblings('ul.branch').addClass('open').removeClass('closed');
            },
            mouseenter : function(){ $(this).find('.icon-folder-close').removeClass('icon-folder-close').addClass('icon-folder-open'); },
            mouseleave : function(){ $(this).find('.icon-folder-open').removeClass('icon-folder-open').addClass('icon-folder-close'); }

        }, '[data-action="open"]');

        target.on({
            'click' :function(){
                var t = $(this);
                t.attr('data-action', 'open');
                t.find('icon-folder-open').removeClass('icon-folder-open').addClass('icon-folder-close');
                t.siblings('ul.branch').addClass('closed').removeClass('open');
            }
        }, '[data-action="close"]');
    }

    function destroy(target){
        target.off();
        target.empty();
    }

    function formatDirTitle(str){
        var arr = str.split("/");
        var title = arr[arr.length-1].toLowerCase();
        return title.substr(0, 1).toUpperCase() + title.substr(1);
    }

    return {
        renderTree : function(obj, target){
            //console.log('building tree %o, %s', obj, target);
            render(obj, target);
        },
        activateTree : function(target){
            activate(target);
        },
        clearTree : function (target){
            destroy(target);
        }
    };
})();

///////////////////////////////////////////////////////////////////////////////
//
//  @comment : enable a device for the ckeditor "nexusmedia" plugin to interface with
//              - the plugin "exec" function requests an en event
//              - the response is in the form of an img string...
//
///////////////////////////////////////////////////////////////////////////////
Nexus.Media.CKPlugin = (function(){
    var ROOT;

    function init(){
        console.log('Nexus.Media.Plugin:: init()');
    }

    function activateBrowser(){
        Nexus.Module.EventDispatcher.on({
            'media-selected' : function(e, args){
                Nexus.Module.EventDispatcher.off('media-selected');
                deactivateBrowser(args);
            },
            'browser-deactivate' : function(e, args){
                Nexus.Module.EventDispatcher.off('browser-deactivate');
                deactivateBrowser(false);
            }
        });

        Nexus.Media.Browser.activate({
            'request'   : 'default',
            'stock'     : true,
            'stockdir'  : 'stock',
            'user'      : true,
            'upload'    : true,
            'format'    : true
        });
    }

    function deactivateBrowser(args){
        //console.log('deactivate browser', args);

        if(args){
            var item = ( args.type.match(/image/gi) !== null )? formatImage(args) : formatDocument(args);
            Nexus.Module.EventDispatcher.trigger('formatted-media-request-received', item);
        } else {
            Nexus.Module.EventDispatcher.trigger('formatted-media-request-cancel');
        }
    }

    // TODO : as this feature takes shape, we may want to develop a more complicated image tag here
    // with sytling, height, format etc.

    function formatImage(args){
        var style;
        switch(args.align){
            case 'left':
                style = 'float:left; margin:0 15px 10px 0;';
                break;
            case 'right':
                style = 'float:right; margin:0 0 10px 15px;';
                break;
            case 'center' :
                style = 'margin: 0 auto 5px auto;';
                break;
            default:
                style = 'margin:0 5px 5px 5px;';
        }

        var src = args.path + args.file;
        var str = '';
        str +=  '<img src="'+src+'" style="'+style+'" />';
        return str;
    }

    function formatDocument(args){
        var src = args.path + args.file;
        var str = '';
        str +=  '<a href="'+src+'" target="_blank">'+args.file+'</a>';
        return str;
    }

    return {
        init : function(){
            ROOT = this;
            init();
        },
        activate : function(){
            activateBrowser();
        }
    };
})();