<%inherit file='../base.mako' />

<%def name="head()">
    <script>
        require(["dojo/parser", "dojo/ready"], function (parser, ready) {
            ready(function() { parser.parse(); });
        });
    </script>
</%def>

<div data-dojo-type="ngw/form/Uploader"></div>

