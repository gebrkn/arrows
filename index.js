window._error = function (e) {
    d3.select("#error").text(e.message);
}

window.onload = function () {

    function guessLang(val) {
        val = val.trim();
        if (!val)
            return "js";
        if (val[0] == "{")
            return "json";
        if (val[0] == "<")
            return "html";
        return "js";
    }

    function plotHTML(html, js) {
        html = "<script>"
            + "_plot = function() { parent.arrows.plot.apply(parent.arrows,arguments) };"
            + "_globals = 0;"
            + "_globals = (function() { "
            + "    var g = Object.keys(window);"
            + "    return function() {"
            + "        return Object.keys(window).filter(function(k) { return g.indexOf(k) < 0})."
            + "            reduce(function(o,k) { return (o[k] = window[k]), o }, {})"
            + "    }})();"
            + "</script>"
            + html
            + "<script>(function() {" + js + "})();</script>"
        document.getElementById("frame").srcdoc = html;
    }

    function plot() {
        d3.select("#error").text("");
        d3.select("#frame").classed("has-frame", false);
        d3.select("#main").classed("has-frame", false);

        var s = code.getValue();

        switch (guessLang(s)) {
            case "json":
                var obj = null;
                try {
                    obj = JSON.parse(s);
                } catch (e) {
                    _error(e);
                    return;
                }
                arrows.plot(obj);
                break;
            case "html":
                d3.select("#frame").classed("has-frame", true);
                d3.select("#main").classed("has-frame", true);
                plotHTML(s, "");
                break;
            case "js":
                plotHTML("", s);
                break;
        }
        d3.select("#panel").classed("closed", true);
    }

    var timer = 0;

    function updateCode() {
        clearTimeout(timer);
        timer = setTimeout(function () {
            switch (guessLang(code.getValue())) {
                case "js":
                case "json":
                    code.setOption("mode", "javascript");
                    break;
                case "html":
                    code.setOption("mode", "htmlmixed");
                    break;
            }
        }, 400);
    }

    var code = CodeMirror.fromTextArea(document.getElementById("code"), {
        lineNumbers: false,
        mode: "htmlmixed",
        theme: "blackboard",
        scrollbarStyle: "simple",
        tabSize: 4
    });


    code.on("change", updateCode);

    updateCode();

    d3.select("#toggle").on("click", function () {
        var p = d3.select("#panel");
        p.classed("closed", !p.classed("closed"));
    });

    d3.select("#btn_plot").on("click", plot);

    d3.select("#btn_png").on("click", function () {
        arrows.asPNG();
    });

    d3.select("#btn_clear").on("click", function () {
        arrows.clear();
    });

    d3.selectAll("input").on("input", function () {
        var v = this.value;
        if (this.type == "number")
            v = parseFloat(v);
        arrows.option(this.name, v);
    });

    d3.selectAll("input").each(function () {
        if (arrows.option(this.name))
            this.value = arrows.option(this.name);
    });

}

