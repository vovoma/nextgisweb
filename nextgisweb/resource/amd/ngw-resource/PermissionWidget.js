define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/_base/array",
    "dojo/store/Memory",
    "dojo/store/Observable",
    "dojo/request/xhr",
    "dojo/json",
    "dojo/dom-construct",
    "dojo/dom-class",
    "dojo/dom-style",
    "dijit/layout/BorderContainer",
    "dijit/Toolbar",
    "dijit/ToolbarSeparator",
    "dijit/form/Button",
    "dijit/Dialog",
    "dijit/form/Select",
    "dijit/form/CheckBox",
    "dojox/layout/TableContainer",
    "dgrid/OnDemandGrid",
    "dgrid/Selection",
    "dgrid/extensions/DijitRegistry",
    "ngw/route",
    "ngw/form/PrincipalSelect",
    "ngw-resource/serialize",
    // resource
    "ngw/load-json!auth/principal/dump",
    "ngw/load-json!resource/schema",
    // css
    "xstyle/css!./resource/PermissionWidget.css",
    "ngw/dgrid/css"
], function (
    declare,
    lang,
    array,
    Memory,
    Observable,
    xhr,
    json,
    domConstruct,
    domClass,
    domStyle,
    BorderContainer,
    Toolbar,
    ToolbarSeparator,
    Button,
    Dialog,
    Select,
    CheckBox,
    TableContainer,
    Grid,
    Selection,
    DijitRegistry,
    route,
    PrincipalSelect,
    serialize,
    principalDump,
    resourceSchema
) {
    var _COUNTER = 0;

    var GridClass = declare([Grid, Selection, DijitRegistry], {
        selectionMode: "single",
        style: "border: none",

        columns: {
            action: {
                label: "Действие",
                get: function (itm) {
                    return {
                        allow: "Разрешить",
                        deny: "Запретить"
                    }[itm.action];
                }
            },

            principal: {
                label: "Субъект",
                get: function (itm) {
                    return this.grid.principalStore.get(itm.principal.id).display_name;
                }},
            
            permission: {
                label: "Право",
                get: function (itm) {
                    if (itm.scope === "" && itm.permission === "") {
                        return "Все ресурсы: Все права";
                    } else if (itm.permission === "") {
                        return resourceSchema.scopes[itm.scope].label + ": " + "Все права";
                    } else {
                        return resourceSchema.scopes[itm.scope].label + ": " + resourceSchema.scopes[itm.scope].permissions[itm.permission].label;
                    }
                }},
            
            identity: {
                label: "Ресурс",
                get: function (itm) {
                    if (itm.identity === "") {
                        return "Все ресурсы";
                    } else {
                        return resourceSchema.resources[itm.identity].label;
                    }
                }},
            
            propagate: {
                label: "Распр.",
                get: function (itm) {
                    if (itm.propagate) {
                        return "Да";
                    } else {
                        return "Нет";
                    }
                }},
        },

        constructor: function () {
            this.principalStore = new Memory({data: principalDump});
        }
    });

    var DialogClass = declare([Dialog], {
        title: "Элемент правил доступа",
        style: "width: 600px",

        buildRendering: function () {
            this.inherited(arguments);

            this.container = new TableContainer({
                cols: 1,
                labelWidth: "150",
                customClass: "dijitDialogPaneContentArea",
            }).placeAt(this);

            this.action = new Select({
                label: "Действие",
                style: "width: 100%",
                options: [
                    {value: "allow", label: "Разрешить"},
                    {value: "deny", label: "Запретить"}
                ]
            }).placeAt(this.container);

            this.principal = new PrincipalSelect({
                label: "Субъект",
                style: "width: 100%",
                required: true
            }).placeAt(this.container);

            var permissionOpts = [{value: ":", label: "Все ресурсы: Все права"}];
            var identityOpts = [{value: "", label: "Все ресурсы"}];

            for (var ks in resourceSchema.scopes) {
                var scope = resourceSchema.scopes[ks];
                
                permissionOpts.push({type: "separator"});
                permissionOpts.push({
                    value: ks + ":",
                    label: scope.label + ": " + "Все права"
                });
                
                for (var kp in scope.permissions) {
                    var permission = scope.permissions[kp];
                    permissionOpts.push({
                        value: ks + ":" + kp,
                        label: scope.label + ": " + permission.label
                    });
                }
            }

            for (var kr in resourceSchema.resources) {
                var resource = resourceSchema.resources[kr];
                identityOpts.push({
                    value: kr,
                    label: resource.label
                });
            }

            this.permission = new Select({
                label: "Право",
                style: "width: 100%",
                options: permissionOpts
            }).placeAt(this.container);

            this.identity = new Select({
                label: "Ресурс",
                style: "width: 100%",
                options: identityOpts
            }).placeAt(this.container);

            this.propagate = new CheckBox({
                label: "Распространять"
            }).placeAt(this.container);

            this.actionBar = domConstruct.create("div", {
                class: "dijitDialogPaneActionBar"
            }, this.containerNode);

            new Button({
                label: "OK",
                onClick: lang.hitch(this, function () {
                    if (this.validate() && this._callback(this.get("value"))) {
                        this.hide();
                    }
                })
            }).placeAt(this.actionBar);
            
            new Button({
                label: "Отмена",
                onClick: lang.hitch(this, this.hide)
            }).placeAt(this.actionBar);
        },

        show: function (callback) {
            this.inherited(arguments);
            this._callback = callback;
        },

        _getValueAttr: function () {
            return {
                id: this._id,
                action: this.action.get("value"),
                principal: { id: this.principal.get("value") },
                scope: this.permission.get("value").split(":")[0],
                permission: this.permission.get("value").split(":")[1],
                identity: this.identity.get("value"),
                propagate: this.propagate.get("checked")
            };
        },

        _setValueAttr: function (value) {
            this._set("value", value);
            this._id = value.id;
            this.action.set("value", value.action);
            this.principal.set("value", value.principal.id);
            this.permission.set("value", value.scope + ":" + value.permission);
            this.identity.set("value", value.identity);
            this.propagate.set("checked", value.propagate);
        }
    });

    return declare([BorderContainer, serialize.Mixin], {
        title: "Права доступа",

        style: "padding: 0px;",
        gutters: false,

        constructor: function (kwArgs) {
            declare.safeMixin(this, kwArgs);

            this.store = new Observable(new Memory({}));

            this.toolbar = new Toolbar({region: "top"});

            this.dialog = new DialogClass();

            this.grid = new GridClass({
                store: this.store,
                region: "center"
            });

            this.grid.on("dgrid-select", lang.hitch(this, function () {
                for (var k in this.grid.selection) {
                    if (this.grid.selection[k]) {
                        this.dialog.set("value", this.store.get(k));
                    }
                }
            }));

            this.grid.on(".dgrid-row:dblclick", lang.hitch(this, this.itemEdit));
        },

        postCreate: function () {
            this.inherited(arguments);
            this.serattrmap.push({key: "resource.permissions", widget: this});
        },

        buildRendering: function () {
            this.inherited(arguments);

            domClass.add(this.domNode, "ngw-resource-permission-widget");

            domStyle.set(this.grid.domNode, "border", "none");
            domClass.add(this.grid.domNode, "dgrid-border-fix");
            domConstruct.place(this.grid.domNode, this.domNode);
            
            new Button({
                label: "Добавить",
                iconClass: "dijitIconNewTask",
                onClick: lang.hitch(this, this.itemAdd)
            }).placeAt(this.toolbar);

            new Button({
                label: "Изменить",
                iconClass: "dijitIconEdit",
                onClick: lang.hitch(this, this.itemEdit)
            }).placeAt(this.toolbar);

            new Button({
                label: "Удалить",
                iconClass: "dijitIconDelete",
                onClick: lang.hitch(this, this.itemRemove)
            }).placeAt(this.toolbar);

            this.toolbar.placeAt(this);
        },

        startup: function () {
            this.inherited(arguments);
            this.grid.startup();
        },

        _setValueAttr: function (value) {
            array.forEach(value, function (i) {
                var c = lang.clone(i);
                c.id = (++_COUNTER);
                this.store.put(c);
            }, this);
        },

        _getValueAttr: function () {
            return this.store.query().map(function (i) {
                var c = lang.clone(i);
                c.id = undefined;
                return c;
            });
        },

        itemAdd: function () {
            this.dialog.show(lang.hitch(this, function (data) {
                data.id = (++_COUNTER);
                this.store.put(data);
                this.grid.clearSelection();
                this.grid.select(data.id);
                return true;
            }));
        },

        itemEdit: function () {
            this.dialog.show(lang.hitch(this, function (data) {
                this.store.put(data);
                this.grid.clearSelection();
                this.grid.select(data.id);
                return true;
            }));
        },

        itemRemove: function () {
            for (var k in this.grid.selection) {
                if (this.grid.selection[k]) {
                    this.store.remove(k);
                }
            }
        }
    });
});