arrows = (function () {

    var nodes = [];
    var links = [];

    var force = null;

    var MAX_VALUE_LEN = 20;
    var LINE_HEIGHT = 20;

    var opts = {
        withProto: true,
        distanceFactor: 3,
        chargeFactor: -90,
        gravity: 0.1
    };

    function option(key, val) {
        if (arguments.length == 2) {
            opts[key] = val;
            if (force)
                force.stop().start();
        }
        return opts[key];
    }

    function plotText(text, depth) {
        var obj;

        try {
            obj = JSON.parse(text);
        } catch (e) {
        }

        if (obj) {
            return plot(obj, depth);
        }

        try {
            eval(text);
        } catch (e) {
            return e.message;
        }
    }

    function plot(obj, depth) {
        inspect(obj, depth || 0);
        draw();
    }

    function clear() {
        nodes = [];
        links = [];
        d3.select("svg").remove();
    }

    function svgSize() {
        var svg = d3.select("svg");
        return [svg.node().offsetWidth, svg.node().offsetHeight];
    }

    function asPNG() {
        var css = [],
            xml = "";


        d3.xhr(d3.select("#theme").attr("href")).get(function (err, r) {
            var css = r.response;
            css += ".icon_pin, .icon_close {display:none}";

            var svg = d3.select("svg"),
                xml = svg.html(),
                w = svg.node().offsetWidth,
                h = svg.node().offsetHeight,
                color = svg.node().style.backgroundColor;

            xml =
                '<?xml version="1.0" encoding="utf-8" standalone="no"?>\n'
                    + '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n'
                    + '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + w + 'px" height="' + h + 'px">\n'
                    + "<style type='text/css'>" + css + "</style>"
                    + xml
                    + "</svg>";

            var canvas = document.createElement("canvas");
            canvas.setAttribute("width", w)
            canvas.setAttribute("height", h)

            var image = new Image();

            image.src = 'data:image/svg+xml;base64,' + window.btoa(xml);
            image.onload = function () {
                var ctx = canvas.getContext('2d');

                ctx.fillStyle = color;
                ctx.fillRect(0, 0, w, h);

                ctx.drawImage(image, 0, 0);

                var a = document.createElement('a');
                a.download = "arrows.png";
                a.href = canvas.toDataURL('image/png');
                document.body.appendChild(a);
                a.click();
            }
        });
    }


    function inspect(obj, depth) {

        function cut(s) {
            if (s.length > MAX_VALUE_LEN)
                return s.substr(0, MAX_VALUE_LEN - 3) + "...";
            return s;
        }

        function name(obj) {
            var m = String(obj).match(/^function\s+(\w+)/);
            if (m)
                return cut(m[1]);
            var m = Object.prototype.toString.call(obj).match(/^\[object\s+(\w+)/);
            if (m)
                return cut(m[1]);
            return "";
        }

        function enumProps(base, withProto) {
            var ps = [];
            try {
                ps = Object.getOwnPropertyNames(base.value);
            } catch (e) {
                return [];
            }

            if (withProto && ps.indexOf("__proto__") < 0)
                ps.push("__proto__");

            return ps.sort(function (a, b) {
                return a.toLowerCase().localeCompare(b.toLowerCase());
            }).map(function (p, i) {
                    var prop = {
                        name: p,
                        base: base,
                        pos: i
                    }

                    try {
                        prop.value = obj[p];
                        prop.type = typeof(value);
                    } catch (e) {
                        prop.value = e.message;
                        prop.type = "error";
                    }

                    return prop;
                });
        }

        var type = obj === null ? "null" : typeof(obj),
            base = {
                type: type,
                props: [],
                value: obj,
                title: type,
                content: ""
            };

        switch (type) {
            case "undefined":
            case "null":
                base.content = "";
                break;
            case "object":
            case "function":
                for (var i = 0; i < nodes.length; i++)
                    if (nodes[i].value === obj)
                        return nodes[i];

                base.content = name(obj);
                base.props = enumProps(base, opts.withProto);
                break;
            default:
                base.content = cut(String(obj));
        }

        var lens = [base.title.length, base.content.length].concat(base.props.map(function (p) {
            return p.name.length
        }));
        base.maxlen = Math.max.apply(Math, lens)

        nodes.push(base);

        if (depth) {
            base.props.forEach(function (p) {
                var n = inspect(p.value, depth - 1);
                links.push({
                    source: base,
                    target: n,
                    prop: p
                });
            })
        }

        return base;
    }

    function draw() {


        function linkDistance(c) {
            var s = svgSize(),
                m = Math.min(s[0], s[1])
            return (m / nodes.length) * opts.distanceFactor;
        }

        function nodeCharge(n) {
            return Math.min(n.width, n.height) * opts.chargeFactor;
        }

        function propY(prop) {
            return -prop.base.height / 2 + (2 + prop.pos) * LINE_HEIGHT;
        }

        function hasLink(prop) {
            return links.some(function (x) {
                return x.prop == prop;
            });
        }

        function deleteNode(n) {
            nodes = nodes.filter(function (x) {
                return n !== x;
            })
            links = links.filter(function (c) {
                return c.source != n && c.target != n;
            })
        }

        function updateSize() {
            var s = svgSize();
            svg.attr("width", s[0]).attr("height", s[1])
                .attr("viewBox", "0 0 " + s[0] + " " + s[1]);
            force.size(s).start();
        }

        function initLayout() {
            var siz = svgSize();
            nodes.forEach(function (n) {
                n.width = n.maxlen * 6 + 20;
                n.height = (2 + n.props.length) * LINE_HEIGHT + 10 * (n.props.length > 0);
            });
        }

        function connector(c) {
            var tx = c.target.x - c.target.width / 2 + 20 + c.target.linkCount * 10,
                sy = c.source.y + propY(c.prop) + LINE_HEIGHT / 2;

            c.target.linkCount++;

            var dx = (c.source.x > c.target.x) ? -1 : +1,
                dy = (c.source.y > c.target.y) ? -1 : +1;

            var sx = dx < 0 ? c.source.x - c.source.width / 2 : c.source.x + c.source.width / 2,
                ty = dy > 0 ? c.target.y - c.target.height / 2 : c.target.y + c.target.height / 2;

            var f = 1 / (1 + c.prop.pos);

            var ky = (c.target.linkCount + 1) * 10,
                kx = (c.prop.pos + 1) * 10;

            return "M" + sx + "," + sy
                + "L" + (sx + dx * kx) + "," + sy
                + "L" + (sx + dx * kx) + "," + (ty - dy * ky)
                + "L" + (tx) + "," + (ty - dy * ky)
                + "L" + tx + "," + ty;
        }

        function transform(n) {
            return "translate(" + (n.x) + "," + (n.y) + ")";
        }

        function onTick() {
            svg.selectAll("g.node").each(function (n) {
                n.linkCount = 0;
                var siz = svgSize();
                n.x = Math.max(10 + n.width / 2, Math.min(siz[0] - n.width / 2 - 10, n.x || 0))
                n.y = Math.max(10 + n.height / 2, Math.min(siz[1] - n.height / 2 - 10, n.y || 0))
            }).attr("transform", transform);
            path.attr("d", connector);
        }

        function onPropClick(prop) {
            if (hasLink(prop)) {
                for (var i = 0; i < links.length; i++) {
                    if (links[i].prop == prop)
                        deleteNode(links[i].target);
                }
            } else {
                links.push({
                    source: prop.base,
                    target: inspect(prop.value, 0),
                    prop: prop
                });
            }

            force.stop();
            draw();
        }


        function onNodeClose(n) {
            force.stop();
            deleteNode(n);
            draw();
        }

        function onNodePin(n) {
            n.fixed = !n.fixed;
            n.g.setAttribute("class", n.fixed ? "node fixed" : "node");
            force.start();
        }

        function drawProps(n, g) {
            var x = -n.width / 2, y = -n.height / 2;

            var b = g.selectAll("g.propbox").data(n.props).enter().append("g").attr("class", function (p) {
                if (hasLink(p))
                    return "propbox active";
                return "propbox";
            });

            b.append("rect")
                .attr("x", x)
                .attr("y", propY)
                .attr("width", n.width)
                .attr("height", LINE_HEIGHT - 4)
                .attr("rx", 5)
                .attr("ry", 5)

                .on("click", onPropClick);

            b.append("text")
                .attr("x", x + 5)
                .attr("y", function (p) {
                    return propY(p) + 12
                })
                .text(function (p) {
                    return p.name
                });
        }

        function drawButton(n, g, y, symbol, fn) {
            g.append("use")
                .attr("xlink:href", "#" + symbol)
                .attr("x", n.width / 2 - 5)
                .attr("y", y)
                .attr("width", 20)
                .attr("height", 20)
                .attr("class", symbol)

            g.append("rect")
                .attr("x", n.width / 2 - 5)
                .attr("y", y)
                .attr("width", 20)
                .attr("height", 15)
                .attr("class", "button")
                .on("click", fn);
        }

        function drawNode(n) {
            var g = d3.select(this);

            g.attr("class", n.fixed ? "node fixed" : "node");
            n.g = this;

            var x = -n.width / 2, y = -n.height / 2;

            g.append("rect")
                .attr("class", "nodebox " + n.type)
                .attr("x", x + 5)
                .attr("y", y + 0)
                .attr("width", n.width - 10)
                .attr("height", n.height)
                .attr("rx", 8)
                .attr("ry", 8);

            g.append("text")
                .attr("x", x + 10)
                .attr("y", y + 18)
                .attr("class", "title")
                .text(n.title);


            g.append("text")
                .attr("x", x + 10)
                .attr("y", y + 32)
                .attr("class", "content")
                .text(n.content);


            drawProps(n, g);
            drawButton(n, g, y, "icon_close", onNodeClose);
            drawButton(n, g, y + 15, "icon_pin", onNodePin);

            //g.append("circle").attr("x", 0).attr("y", 0).attr("r", 4).attr("fill", "red")
        }

        d3.select("svg").remove();
        var svg = d3.select("#main").append("svg");

        initLayout();

        force = d3.layout.force()
            .nodes(nodes)
            .links(links)
            .gravity(function () {
                return opts.gravity
            })
            .linkDistance(linkDistance)
            .charge(nodeCharge)
            .on("tick", onTick);

        svg.append("defs").append("marker")
            .attr("id", "marker_end")
            .attr("viewBox", "0 0 16 16")
            .attr("refX", 16)
            .attr("refY", 8)
            .attr("markerWidth", 8)
            .attr("markerHeight", 8)
            .attr("orient", "auto")
            .append("path")
            .attr("d", "M 0 0 L 16 8 L 0 16 z");
        svg.select("defs").append("marker_start")
            .attr("id", "marker_start")
            .attr("viewBox", "0 0 16 16")
            .attr("refX", 16)
            .attr("refY", 8)
            .attr("markerWidth", 8)
            .attr("markerHeight", 8)
            .attr("orient", "auto")
            .append("circle")
            .attr("r", "8");

        svg.append("symbol")
            .attr("id", "icon_pin")
            .attr("viewBox", "0 0 1009 1024")
            .append("path")
            .attr("d", "M581.122 207.886l-37.532 112.179-112.596 112.596-37.532-37.49-112.638 37.49 112.638 112.638-37.532 37.49-155.55 232.282 230.614-157.176 37.49-37.574-1.209-10.009 113.847 122.646 37.532-112.638-37.532-37.532 112.596-112.596 112.137-37.532z")

        svg.append("symbol")
            .attr("id", "icon_close")
            .attr("viewBox", "0 0 1009 1024")
            .append("path")
            .attr("d", "M671.407 376.488l-52.128-52.128-114.681 114.681-114.681-114.681-52.128 52.128 114.681 114.681-114.681 114.681 52.128 52.128 114.681-114.681 114.681 114.681 52.128-52.128-114.681-114.681z")

        svg.selectAll("g.node")
            .data(nodes).enter().append("g").each(drawNode);

        svg.selectAll("g.node").call(force.drag)

        var path = svg.append("g").selectAll("path")
            .data(force.links())
            .enter().append("path")
            .attr("class", "proplink")
            .attr("marker-start", "url(#marker_start)")
            .attr("marker-end", "url(#marker_end)");


        updateSize();
        force.start();
        window.onresize = updateSize;
    }

    return {
        plot: plot,
        plotText: plotText,
        option: option,
        asPNG: asPNG,
        clear: clear
    }

})();