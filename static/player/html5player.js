function formatTime(seconds) {
    var minutes = Math.floor(seconds / 60);
    var seconds = Math.floor(seconds - minutes * 60);
    return minutes + ':' + ("00" + seconds).slice(-2)
}

function DGHTML5Player(player, DGPlayer) {
    this.player = player;
    this.ui = DGPlayer;

    var onplay, onpause, onvolume, onseek;

    DGPlayer.seekTime = 0;
    DGPlayer.duration = 0;
    DGPlayer.state = 'playing';

    player.bind('playing', function () {
        DGPlayer.state = 'playing';
        console.log('Player pliaying, state = playing');
    });
    player.bind('pause', function () {
        DGPlayer.state = 'paused';
        console.log('Player pause, state = paused');
    });
    player.bind('timeupdate', function () {
        DGPlayer.seekTime = player.getTime() * 1000;
    });
    player.bind('loadedmetadata', function () {
        DGPlayer.duration = player.getDuration() * 1000;
    });
//    player.bind('ended', function () {
//        DGPlayer.duration = 0;
//        DGPlayer.seekTime = 0;
//        DGPlayer.state = 'paused';
//    });

    DGPlayer.on('play', onplay = function () {
        player.play();
        console.log('DGPlayer play: playing');
    });
    DGPlayer.on('pause', onpause = function () {
        player.pause();
        console.log('DGPlayer pause: pausing');
    });
    DGPlayer.on('volume', onvolume = function () {
        player.setVolume(DGPlayer.volume);
    });
    DGPlayer.on('seek', onseek = function (offset) {
        player.setTime(offset / 1000.0);
    })

    this.disconnect = function () {
        player.unbind('playing');
        player.unbind('pause');
        player.unbind('timeupdate');
        player.unbind('loadedmetadata');
        player.unbind('ended');

        DGPlayer.off('play', onplay);
        DGPlayer.off('pause', onpause);
        DGPlayer.off('volume', onvolume);
        DGPlayer.off('seek', onseek);
    }

    player.setVolume(DGPlayer.volume);
    player.play();
}

function multiplayer(dgPlayer, urls) {
    var currentAurora, currentBuzz;
    var API = {
        endedCallback: function () {
        }
    };

    function stopCurrent() {
        console.log('Disconnect everything');
        if (currentAurora) {
            currentAurora.ui.disconnect();
            currentAurora.player.stop();
            currentAurora = null;
        }
        if (currentBuzz) {
            currentBuzz.ui.disconnect();
            currentBuzz.player.stop();
            currentBuzz.player.sound.src = '';
            currentBuzz = null;
        }
    }

    function playAurora(url) {
        console.log('Aurora play ' + url);

        currentAurora = {}
        currentAurora.player = AV.Player.fromURL(url)
        currentAurora.ui = new DGAuroraPlayer(currentAurora.player, dgPlayer);
        currentAurora.player.on('end', function () {
            console.log('ended. calling endedCallback');
            API.endedCallback();
        })
        window.p = currentAurora.player;
        scrobble(dgPlayer.songArtist,  dgPlayer.songTitle);
    }

    function playBuzz(url) {
        console.log('Buzz play ' + url);

        currentBuzz = {}
        currentBuzz.player = new buzz.sound(url, {
            autoplay: true
        });
        currentBuzz.player.bind('pause.multiplayer', function () {
            if (this.isEnded()) {
                API.endedCallback();
            }
        })
        currentBuzz.ui = new DGHTML5Player(currentBuzz.player, dgPlayer);
        scrobble(dgPlayer.songArtist,  dgPlayer.songTitle);
    }

    function loadMetadata(url) {
        $.getJSON(urls.metadata, { path: url }, function (resp) {
            dgPlayer.songArtist = resp.artist;
            dgPlayer.songTitle = resp.title;
        })
        dgPlayer.coverArt = urls.coverArt + '?path=' + encodeURIComponent(url);
    }

    API.playUrl = function (playerType, url) {
        var fileUrl = urls.file + '?path=' + encodeURIComponent(url);
        stopCurrent();

        if (playerType == 'aurora') {
            playAurora(fileUrl);
        } else if (playerType == 'buzz') {
            playBuzz(fileUrl);
        }
        loadMetadata(url);
        API.currentUrl = url;
    }

    API.getIsPlaying = function () {
        if (currentAurora) {
            return currentAurora.player.playing;
        } else if (currentBuzz) {
            return !currentBuzz.player.isPaused();
        }
        return false;
    }

    return API;
}

function openPlayer(playlist) {
    window.open(playerUrl + '?playlist=' + playlist,
        'player', 'height=670,width=400,menubar=no,status=no,toolbar=no');
}

function playWhat(whatId) {
    openPlayer('what/' + whatId);
}
// using jQuery
function getCookie(name) {
    var cookieValue = null;
    if (document.cookie && document.cookie != '') {
        var cookies = document.cookie.split(';');
        for (var i = 0; i < cookies.length; i++) {
            var cookie = jQuery.trim(cookies[i]);
            // Does this cookie string begin with the name we want?
            if (cookie.substring(0, name.length + 1) == (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}
var csrftoken = getCookie('csrftoken');
    function sameOrigin(url) {
    // test that a given url is a same-origin URL
    // url could be relative or scheme relative or absolute
    var host = document.location.host; // host + port
    var protocol = document.location.protocol;
    var sr_origin = '//' + host;
    var origin = protocol + sr_origin;
    // Allow absolute or scheme relative URLs to same origin
    return (url == origin || url.slice(0, origin.length + 1) == origin + '/') ||
            (url == sr_origin || url.slice(0, sr_origin.length + 1) == sr_origin + '/') ||
            // or any other URL that isn't scheme relative or absolute i.e relative.
            !(/^(\/\/|http:|https:).*/.test(url));
    }
$.ajaxSetup({
    beforeSend: function(xhr, settings) {
        if (sameOrigin(settings.url)) {
            // Send the token to same-origin, relative URLs only.
            // Send the token only if the method warrants CSRF protection
            // Using the CSRFToken value acquired earlier
            xhr.setRequestHeader("X-CSRFToken", csrftoken);
        }
    }
});
function scrobble(songArtist, songTitle) {
    $.post( window.location.href.replace(window.location.search, '').replace('player','lastfm/scrobble'), JSON.stringify({ "artist": songArtist, "title" : songTitle}) );
}