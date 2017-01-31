function addInfo(){
    if (typeof urlq !== 'undefined') {
        $("#qfield").attr('value', urlq.replace(/\+/g, " "));
    }

    var vf = QueryString.vfilter;
    if (typeof vf === 'undefined') {
        vf = 'all';
    }
    var tf = QueryString.timefilter;
    if (typeof tf === 'undefined') {
        tf = 'week';
    }
    var link_endpoint = '/';
    if (render_format === 'recent') {
        link_endpoint = '';
    }
    if (render_format === 'top') {
        link_endpoint = 'top';
    }
    if (render_format === 'recommend') {
        link_endpoint = 'recommend';
    }

    var time_ranges = ['day', '3days', 'week', 'month', 'year', 'alltime'];
    var time_txt = {
        'day': 'Last day',
        '3days': 'Last 3 days',
        'week': 'Last week',
        'month': 'Last month',
        'year': 'Last year',
        'alltime': 'All time'
    };
    var time_range = tf;

    var elt = $('#recommend-time-choice');
    // set up time filtering options
    if (render_format === 'recommend' || render_format === 'top' || render_format === 'recent') {
        // insert version filtering options for these views
        var vflink = vf === 'all' ? '1' : 'all'; // toggle only showing v1 or not
        if (render_format === 'recent') {
            var aelt = $('<a>').attr('href', '/' + link_endpoint + '?' + '&vfilter=' + vflink); // leave out timefilter from this page
            elt.append(aelt);
        } else {
            var aelt = $('<a>').attr('href', '/' + link_endpoint + '?' + 'timefilter=' + time_range + '&vfilter=' + vflink);
            elt.append(aelt);
        }
        var delt = $('<div>').addClass('vchoice').html('Only show v1');
        aelt.append(delt);
        if (vf === '1') {
            delt.addClass('vchoice-selected');
        }
    }

    if (render_format === 'recommend' || render_format === 'top') {
        // insert time filtering options for these two views
        elt.append($('<div>').addClass('fdivider').html('|'));
        for (var i = 0; i < time_ranges.length; i++) {
            var time_range = time_ranges[i];
            var aelt = elt.append($('<a>').attr('href', '/' + link_endpoint + '?' + 'timefilter=' + time_range + '&vfilter=' + vf));
            elt.append(aelt);
            var delt = $('<div>').addClass('timechoice').html(time_txt[time_range]);
            aelt.append(delt);
            if (tf == time_range) {
                delt.addClass('timechoice-selected');
            } // also render as chosen
        }
    }

    elt.append($('<div>').addClass('divider col s12'));
    // If render format is most similar paper remove info bar
    if (render_format === 'paper' || render_format === 'search') {
        $("#info").remove();
    }
}
