/* Lampa Shikimori - independent preview 0.1.0
 * Public catalogue and search. Account integration requires OAuth bridge.
 * Source: https://github.com/anicim/lampa-plugins
 */
(function () {
  'use strict';
  if (window.anicim_shikimori_v1) return;
  window.anicim_shikimori_v1 = true;

  var API = 'https://shikimori.io/api/graphql';
  var COMPONENT = 'AnicimShikimori';
  var LIMIT = 24;
  var PAGE_MAX = 30;

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];
    });
  }
  function notify(text) {
    if (Lampa.Noty && Lampa.Noty.show) Lampa.Noty.show(text);
    else console.warn('[Shikimori]', text);
  }
  function request(page, phrase) {
    var query = 'query AnimeList($page: PositiveInt!, $limit: PositiveInt!, $search: String) {' +
      ' animes(page:$page,limit:$limit,search:$search,order:ranked) {' +
      ' id name russian kind score status episodes poster { mainUrl originalUrl } ' +
      ' airedOn { year } }}';
    return new Promise(function(resolve, reject) {
      $.ajax({
        url: API, type:'POST', contentType:'application/json',
        data:JSON.stringify({query:query,variables:{page:page,limit:LIMIT,search:phrase || null}}),
        timeout:16000,
        success:function(data) {
          if(data.errors && data.errors.length) return reject(new Error(data.errors[0].message));
          resolve(data.data && data.data.animes || []);
        },
        error:function(xhr) {reject(new Error('HTTP '+(xhr.status || 'network')));}
      });
    });
  }
  function Component(params) {
    var self = this;
    var scroll = new Lampa.Scroll({mask:true,over:true,step:200});
    var root = $('<div class="anicim-shiki"></div>');
    var controls = $('<div class="anicim-shiki-head"></div>');
    var results = $('<div class="category-full anicim-shiki-results"></div>');
    var page = 0, loading = false, exhausted = false, phrase = '';
    var lastFocus;

    function action(label, handler) {
      var node = $('<div class="selector simple-button simple-button--filter"></div>').text(label);
      node.on('hover:enter',handler);
      controls.append(node);
      return node;
    }
    var home = action('Каталог', function(){ reset(''); });
    action('Поиск',function(){
      if(!Lampa.Input || !Lampa.Input.edit) {
        notify('В этой сборке Lampa недоступен ввод текста');return;
      }
      Lampa.Input.edit({title:'Поиск аниме',value:phrase,free:true,nosave:true},function(text){
        reset(String(text || '').trim());
      });
    });
    action('Мои списки',function(){
      notify('Для личных списков требуется настройка защищённого входа Shikimori OAuth');
    });

    function card(item) {
      var image = item.poster && (item.poster.mainUrl || item.poster.originalUrl);
      var title = item.russian || item.name || 'Без названия';
      var img = image && /^https:\/\//.test(image) ? image : '';
      var node = $('<div class="card selector anicim-shiki-card"></div>');
      var view = $('<div class="card__view"></div>');
      $('<img class="card__img" loading="lazy"/>').attr('src',img).attr('alt',title).appendTo(view);
      $('<div class="card__vote"></div>').text(item.score || '').appendTo(view);
      view.appendTo(node);
      $('<div class="card__title"></div>').text(title).appendTo(node);
      node.on('hover:enter',function(){
        var url = 'https://shikimori.io/animes/'+encodeURIComponent(item.id);
        if(Lampa.Select && Lampa.Select.show) {
          Lampa.Select.show({title:title,items:[
            {title:'Открыть на Shikimori',action:'open'},
            {title:'ID Shikimori: '+item.id,action:'info'}
          ],onSelect:function(choice){
            if(choice.action==='open') {
              if(Lampa.Platform && Lampa.Platform.open) Lampa.Platform.open(url);
              else window.open(url,'_blank');
            } else notify(title+' · ID '+item.id);
          },onBack:function(){Lampa.Controller.toggle(COMPONENT);}});
        }
      });
      return node;
    }
    function load() {
      if(loading || exhausted || page>=PAGE_MAX) return;
      loading=true;
      var targetPage=page+1;
      request(targetPage,phrase).then(function(items) {
        page=targetPage;
        if(items.length<LIMIT) exhausted=true;
        items.forEach(function(item){results.append(card(item));});
        if(page===1 && !items.length) notify('Аниме не найдены');
        self.activity.loader(false);
        self.start();
      }).catch(function(err){
        console.error('[Shikimori] Catalogue error',err);
        self.activity.loader(false);
        notify('Shikimori API: '+err.message);
      }).finally(function(){loading=false;});
    }
    function reset(query) {
      phrase=query;page=0;exhausted=false;
      results.empty();load();
      try{scroll.scrollTo(0,0);}catch(e){}
    }
    this.create=function(){
      scroll.minus();
      scroll.onWheel=function(step){
        if(!Lampa.Controller.own(self)) self.start();
        if(window.Navigator) Navigator.move(step>0?'down':'up');
      };
      scroll.onEnd=function(){load();};
      scroll.append(controls);
      scroll.append(results);
      root.append(scroll.render(true));
      self.activity.loader(true);
      load();
    };
    this.start=function(){
      Lampa.Controller.add(COMPONENT,{
        toggle:function(){
          Lampa.Controller.collectionSet(root);
          Lampa.Controller.collectionFocus(lastFocus || home[0],root);
        },
        up:function(){if(window.Navigator)Navigator.move('up');},
        down:function(){if(window.Navigator)Navigator.move('down');},
        left:function(){if(window.Navigator)Navigator.move('left');},
        right:function(){if(window.Navigator)Navigator.move('right');},
        back:function(){Lampa.Activity.backward();}
      });
      Lampa.Controller.toggle(COMPONENT);
    };
    this.pause=function(){};
    this.stop=function(){};
    this.render=function(){return root;};
    this.destroy=function(){scroll.destroy();root.remove();};
  }
  function boot() {
    if(!window.Lampa || !Lampa.Component || !Lampa.Activity) return;
    if(window.__anicim_shiki_booted) return;
    window.__anicim_shiki_booted=true;
    Lampa.Component.add(COMPONENT,Component);
    var button=$('<li class="menu__item selector"><div class="menu__text">Shikimori</div></li>');
    button.on('hover:enter',function(){
      Lampa.Activity.push({title:'Shikimori',component:COMPONENT,page:1});
    });
    $('.menu .menu__list').eq(0).append(button);
    console.info('[Shikimori] Catalogue preview v0.1.0 installed');
  }
  if(window.appready) boot();
  else if(window.Lampa && Lampa.Listener) Lampa.Listener.follow('app',function(e){if(e.type==='ready')boot();});
})();