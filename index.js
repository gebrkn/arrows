function evalJS(s) {
    let ret = ["let __R = {}"];
    let tpl = "if (typeof @ !== 'undefined') __R['@'] = @";

    s.replace(/^\s*(?:var|let|const)\s+(\w+)/gm, function(_, v) {
        ret.push(tpl.replace(/@/g, v))
    });

    ret.push("return __R");
    ret = ret.join(';');

    try {
        let f = new Function(s + ';' + ret);
        return [f(), 'js']
    } catch (e) {
        return [e, 'error'];
    }
}


window.onload = function () {

    function evalIt(s) {
        s = s.trim();

        if (!s)
            return ['', 'null'];


        try {
            return [JSON.parse(s), 'json'];
        } catch (e) {
        }
        ;

        return evalJS(s);
    }

    function showError(e) {
        d3.select("#hint").classed("error", true).text(e ? e.message : '');
    }

    function plot() {
        d3.select("#hint").text("");
        d3.select("#frame").classed("has-frame", false);
        d3.select("#main").classed("has-frame", false);

        var txt = code.getValue().trim(),
            res = evalIt(txt);

        if (res[1] === 'null') {
            return;
        }

        if (res[1] === 'error') {
            showError(res[0]);
            return;
        }

        if (res[1] === 'json') {
            arrows.plot(res[0], {}, "JSON");
        }

        if (res[1] === 'js') {
            for (var v in res[0]) {
                arrows.plot(res[0][v], {withProto: true, withFunctions: true}, v, 0);
            }
        }
    }

    var timer = 0;

    function updateCode() {
        clearTimeout(timer);
        timer = setTimeout(function () {
            showError(null);

            var res = evalIt(code.getValue().trim());
            switch (res[1]) {
                case "js":
                case "json":
                    code.setOption("mode", "javascript");
                    break;
                case "html":
                    code.setOption("mode", "htmlmixed");
                    break;
                case "error":
                    showError(res[0]);
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
        var p = d3.select("body");
        p.classed("panel-closed", !p.classed("panel-closed"));
    });

    d3.select("#btn_plot").on("click", plot);

    d3.select("#btn_png").on("click", function () {
        arrows.asPNG();
    });

    d3.select("#btn_clear").on("click", function () {
        arrows.clear();
    });

    var pinned = false;

    d3.select("#btn_pin").on("click", function () {
        if (pinned) {
            arrows.unpinAll();
        } else {
            arrows.pinAll();
        }
        pinned = !pinned;
        d3.select("#btn_pin").text(pinned ? "unpin all" : "pin all");
    });

    d3.selectAll("input").on("input", function () {
        var v = this.value;
        if (this.type === "number")
            v = parseFloat(v);
        arrows.option(this.name, v);
    });

    d3.selectAll("input").each(function () {
        if (arrows.option(this.name))
            this.value = arrows.option(this.name);
    });

}

