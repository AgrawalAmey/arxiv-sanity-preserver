// helper function so that we can access keys in url bar
var QueryString = function() {
    // This function is anonymous, is executed immediately and
    // the return value is assigned to QueryString!
    var query_string = {};
    var query = window.location.search.substring(1);
    var vars = query.split("&");
    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split("=");
        // If first entry with this name
        if (typeof query_string[pair[0]] === "undefined") {
            query_string[pair[0]] = decodeURIComponent(pair[1]);
            // If second entry with this name
        } else if (typeof query_string[pair[0]] === "string") {
            var arr = [query_string[pair[0]], decodeURIComponent(pair[1])];
            query_string[pair[0]] = arr;
            // If third or later entry with this name
        } else {
            query_string[pair[0]].push(decodeURIComponent(pair[1]));
        }
    }
    return query_string;
}();

// for dealing with ids that have . in them
function jq(myid) {
    return myid.replace(/(:|\.|\[|\]|,)/g, "\\$1");
}

function build_ocoins_str(p) {
    var ocoins_info = {
        "ctx_ver": "Z39.88-2004",
        "rft_val_fmt": "info:ofi/fmt:kev:mtx:journal",
        "rfr_id": "info:sid/arxiv-sanity.com:arxiv-sanity",

        "rft_id": p.link,
        "rft.atitle": p.title,
        "rft.jtitle": "arXiv:" + p.pid + " [" + p.category.substring(0, p.category.indexOf('.')) + "]",
        "rft.date": p.published_time,
        "rft.artnum": p.pid,
        "rft.genre": "preprint",

        // NB: Stolen from Dublin Core; Zotero understands this even though it's
        // not part of COinS
        "rft.description": p.abstract,
    };
    ocoins_info = $.param(ocoins_info);
    ocoins_info += "&" + $.map(p.authors, function(a) {
        return "rft.au=" + encodeURIComponent(a);
    }).join("&");

    return ocoins_info;
}

function build_authors_html(authors) {
    var res = '';
    for (var i = 0, n = authors.length; i < n; i++) {
        var link = '/search?q=' + authors[i].replace(/ /g, "+");
        res += '<a href="' + link + '">' + authors[i] + '</a>';
        if (i < n - 1) res += ', ';
    }
    return res;
}

function build_categories_html(tags) {
    var res = '';
    for (var i = 0, n = tags.length; i < n; i++) {
        var link = '/search?q=' + tags[i].replace(/ /g, "+");
        res += '<a href="' + link + '">' + tags[i] + '</a>';
        if (i < n - 1) res += ' | ';
    }
    return res;
}

function saveScrollPosition(){
    // Set a cookie that holds the scroll position.
    $.cookie("scroll", $(document).scrollTop() );
    // set a cookie that holds the current location.
    $.cookie("location", $(location).attr('href'));
}

function retriveScrollPosition(){
    // If scroll AND location cookie is set, and the location is the same
    //scroll to the position saved in the scroll cookie.
    if ( $.cookie("scroll") !== null && $.cookie("location") !== null && $.cookie("location") == $(location).attr('href')) {
        $(document).scrollTop($.cookie("scroll"));
    }
}
