/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

define(['require',
    'backbone',
    'hbs!tmpl/search/QueryBuilder_tmpl',
    'hbs!tmpl/search/UserDefine_tmpl',
    'utils/Utils',
    'utils/CommonViewFunction',
    'utils/Enums',
    'query-builder',
    'daterangepicker'
], function(require, Backbone, QueryBuilderTmpl, UserDefineTmpl, Utils, CommonViewFunction, Enums) {

    var QueryBuilderView = Backbone.Marionette.LayoutView.extend(
        /** @lends QueryBuilderView */
        {
            _viewName: 'QueryBuilderView',

            template: QueryBuilderTmpl,



            /** Layout sub regions */
            regions: {},


            /** ui selector cache */
            ui: {
                "builder": "#builder"
            },
            /** ui events hash */
            events: function() {
                var events = {};
                return events;
            },
            /**
             * intialize a new QueryBuilderView Layout
             * @constructs
             */
            initialize: function(options) {
                _.extend(this, _.pick(options,
                    'attrObj',
                    'value',
                    'typeHeaders',
                    'entityDefCollection',
                    'enumDefCollection',
                    'classificationDefCollection',
                    'nameSpaceCollection',
                    'tag',
                    'type',
                    'searchTableFilters',
                    'systemAttrArr'));
                this.attrObj = _.sortBy(this.attrObj, 'name');
                //this.systemAttrArr = _.sortBy(this.systemAttrArr, 'name');
                this.filterType = this.tag ? 'tagFilters' : 'entityFilters';
            },
            bindEvents: function() {},
            getOperator: function(type, skipDefault) {
                var obj = {
                    operators: null
                }
                if (type === "string") {
                    obj.operators = ['=', '!=', 'contains', 'begins_with', 'ends_with'];
                }
                if (type === "date" || type === "int" || type === "byte" || type === "short" || type === "long" || type === "float" || type === "double") {
                    obj.operators = ['=', '!=', '>', '<', '>=', '<='];
                }
                if (type === "enum" || type === "boolean") {
                    obj.operators = ['=', '!='];
                }
                if (_.isEmpty(skipDefault) && obj.operators) {
                    obj.operators = obj.operators.concat(['is_null', 'not_null']);
                }
                return obj;
            },
            isPrimitive: function(type) {
                if (type === "int" || type === "byte" || type === "short" || type === "long" || type === "float" || type === "double" || type === "string" || type === "boolean" || type === "date") {
                    return true;
                }
                return false;
            },
            getUserDefineInput: function() {
                return UserDefineTmpl();
            },
            getObjDef: function(attrObj, rules, isGroup, groupType, isSystemAttr) {
                var that = this;
                if (attrObj.name === "__classificationsText" || attrObj.name === "__historicalGuids") {
                    return;
                }
                var getLableWithType = function(label, name) {
                    if (name === "__classificationNames" || name === "__customAttributes" || name === "__labels" || name === "__propagatedClassificationNames") {
                        return label;
                    } else {
                        return label + " (" + attrObj.typeName + ")";
                    }

                }
                var label = (Enums.systemAttributes[attrObj.name] ? Enums.systemAttributes[attrObj.name] : _.escape(attrObj.name.capitalize()));
                var obj = {
                    id: attrObj.name,
                    label: getLableWithType(label, attrObj.name),
                    plainLabel: label,
                    type: _.escape(attrObj.typeName),
                    validation: {
                        callback: function(value, rule) {
                            if (rule.operator.nb_inputs === false || !_.isEmpty(value) || !value instanceof Error) {
                                return true;
                            } else {
                                if (value instanceof Error) {
                                    return value.message; // with params
                                } else {
                                    return rule.filter.plainLabel + ' is required'; // with params
                                }
                            }
                        }
                    }
                };
                if (isGroup) {
                    obj.optgroup = groupType;
                }
                /* __isIncomplete / IsIncomplete */
                if (isSystemAttr && attrObj.name === "__isIncomplete" || isSystemAttr && attrObj.name === "IsIncomplete") {
                    obj.type = "boolean";
                    obj.label = (Enums.systemAttributes[attrObj.name] ? Enums.systemAttributes[attrObj.name] : _.escape(attrObj.name.capitalize())) + " (boolean)";
                    obj['input'] = 'select';
                    obj['values'] = [{ 1: 'true' }, { 0: 'false' }];
                    _.extend(obj, this.getOperator("boolean"));
                    return obj;
                }
                /* Status / __state */
                if (isSystemAttr && attrObj.name === "Status" || isSystemAttr && attrObj.name === "__state") {
                    obj.label = (Enums.systemAttributes[attrObj.name] ? Enums.systemAttributes[attrObj.name] : _.escape(attrObj.name.capitalize())) + " (enum)";
                    obj['input'] = 'select';
                    obj['values'] = ['ACTIVE', 'DELETED'];
                    _.extend(obj, this.getOperator("boolean", true));
                    return obj;
                }
                /* __classificationNames / __propagatedClassificationNames */
                if (isSystemAttr && attrObj.name === "__classificationNames" || attrObj.name === "__propagatedClassificationNames") {
                    obj["plugin"] = "select2";
                    obj["input"] = 'select';
                    obj["plugin_config"] = {
                        placeholder: "Select classfication",
                        tags: true,
                        multiple: false,
                        data: this.classificationDefCollection.fullCollection.models.map(function(o) { return { "id": o.get("name"), "text": o.get("name") } })
                    };
                    obj["valueSetter"] = function(rule) {
                        if (rule && !_.isEmpty(rule.value)) {
                            var selectEl = rule.$el.find('.rule-value-container select')
                            var valFound = that.classificationDefCollection.fullCollection.find(function(o) {
                                return o.get("name") === rule.value
                            })
                            if (valFound) {
                                selectEl.val(rule.value).trigger("change");
                            } else {
                                var newOption = new Option(rule.value, rule.value, false, false);
                                selectEl.append(newOption).val(rule.value);
                            }
                        }
                    };
                    _.extend(obj, this.getOperator("string"));
                    return obj;
                }
                /* __customAttributes */
                if (isSystemAttr && attrObj.name === "__customAttributes") {
                    obj["input"] = function(rule) {
                        return rule.operator.nb_inputs ? that.getUserDefineInput() : null
                    }
                    obj["valueGetter"] = function(rule) {
                        if (rule.operator.type === "contains") {
                            var $el = rule.$el.find('.rule-value-container'),
                                key = $el.find("[data-type='key']").val(),
                                val = $el.find("[data-type='value']").val();
                            if (!_.isEmpty(key) && !_.isEmpty(val)) {
                                return key + "=" + val;
                            } else {
                                return new Error("Key & Value is Required");
                            }
                        }
                    }
                    obj["valueSetter"] = function(rule) {
                        if (!rule.$el.hasClass("user-define")) {
                            rule.$el.addClass("user-define");
                        }
                        if (rule.value && !(rule.value instanceof Error)) {
                            var $el = rule.$el.find('.rule-value-container'),
                                value = rule.value.split("=");
                            if (value) {
                                $el.find("[data-type='key']").val(value[0]),
                                    $el.find("[data-type='value']").val(value[1]);
                            }
                        }
                    }

                    obj.operators = ['contains', 'is_null', 'not_null'];
                    return obj;
                }
                /* __labels */
                if (isSystemAttr && attrObj.name === "__labels") {
                    obj["plugin"] = "select2";
                    obj["input"] = 'select';
                    obj["plugin_config"] = {
                        placeholder: "Enter Label(s)",
                        tags: true,
                        "language": {
                            "noResults": function() { return ''; }
                        },
                        multiple: false
                    };
                    obj["valueSetter"] = function(rule) {
                        if (rule && !_.isEmpty(rule.value)) {
                            var newOption = new Option(rule.value, rule.value, true, false);
                            return rule.$el.find('.rule-value-container select').append(newOption);
                        }
                    }
                    _.extend(obj, this.getOperator("string"));
                    return obj;
                }
                /* __typeName */
                if (isSystemAttr && attrObj.name === "__typeName") {
                    var entityType = [];
                    that.typeHeaders.fullCollection.each(function(model) {
                        if (model.get('category') == 'ENTITY') {
                            entityType.push({
                                "id": model.get("name"),
                                "text": model.get("name")
                            })
                        }
                    });
                    obj["plugin"] = "select2";
                    obj["input"] = 'select';
                    obj["plugin_config"] = {
                        placeholder: "Select type",
                        tags: true,
                        multiple: false,
                        data: entityType
                    };
                    obj["valueSetter"] = function(rule) {
                        if (rule && !_.isEmpty(rule.value)) {
                            var selectEl = rule.$el.find('.rule-value-container select')
                            var valFound = that.typeHeaders.fullCollection.find(function(o) {
                                return o.get("name") === rule.value
                            })
                            if (valFound) {
                                selectEl.val(rule.value).trigger("change");
                            } else {
                                var newOption = new Option(rule.value, rule.value, false, false);
                                selectEl.append(newOption).val(rule.value);
                            }
                        }
                    };
                    _.extend(obj, this.getOperator("string"));
                    return obj;
                }
                if (obj.type === "date") {
                    obj['plugin'] = 'daterangepicker';
                    obj['plugin_config'] = {
                        "singleDatePicker": true,
                        "showDropdowns": true,
                        "timePicker": true,
                        locale: {
                            format: 'MM/DD/YYYY h:mm A'
                        }
                    };
                    if (rules) {
                        var valueObj = _.find(rules, { id: obj.id });
                        if (valueObj) {
                            obj.plugin_config["startDate"] = valueObj.value;
                        }
                    }
                    _.extend(obj, this.getOperator(obj.type));
                    return obj;
                }
                if (this.isPrimitive(obj.type)) {
                    if (obj.type === "boolean") {
                        obj['input'] = 'select';
                        obj['values'] = ['true', 'false'];
                    }
                    _.extend(obj, this.getOperator(obj.type));
                    if (_.has(Enums.regex.RANGE_CHECK, obj.type)) {
                        obj.validation = {
                            min: Enums.regex.RANGE_CHECK[obj.type].min,
                            max: Enums.regex.RANGE_CHECK[obj.type].max
                        };
                        if (obj.type === "double" || obj.type === "float") {
                            obj.type = "double";
                        } else if (obj.type === "int" || obj.type === "byte" || obj.type === "short" || obj.type === "long") {
                            obj.type = "integer"
                        }
                    }
                    return obj;
                }
                var enumObj = this.enumDefCollection.fullCollection.find({ name: obj.type });
                if (enumObj) {
                    obj.type = "string";
                    obj['input'] = 'select';
                    var value = [];
                    _.each(enumObj.get('elementDefs'), function(o) {
                        value.push(o.value)
                    })
                    obj['values'] = value;
                    _.extend(obj, this.getOperator('enum'));
                    return obj;
                }
            },
            onRender: function() {
                var that = this,
                    filters = [],
                    isGroupView = false,
                    placeHolder = '--Select Attribute--';
                if (this.attrObj.length > 0 && this.systemAttrArr.length > 0) {
                    isGroupView = true;
                } else if (this.attrObj.length === 0 || this.systemAttrArr.length === 0) {
                    isGroupView = false;
                }
                if (this.attrObj.length === 0) {
                    placeHolder = '--Select System Attribute--';
                }
                if (this.value) {
                    var rules_widgets = CommonViewFunction.attributeFilter.extractUrl({ "value": this.searchTableFilters[this.filterType][(this.tag ? this.value.tag : this.value.type)], "formatDate": true });
                }
                _.each(this.attrObj, function(obj) {
                    var type = that.tag ? 'Classification' : 'Entity';
                    var returnObj = that.getObjDef(obj, rules_widgets, isGroupView, 'Select ' + type + ' Attribute');
                    if (returnObj) {
                        filters.push(returnObj);
                    }
                });
                var sortMap = {
                    "__guid": 1,
                    "__typeName": 2,
                    "__timestamp": 3,
                    "__modificationTimestamp": 4,
                    "__createdBy": 5,
                    "__modifiedBy": 6,
                    "__isIncomplete": 7,
                    "__state": 8,
                    "__classificationNames": 9,
                    "__propagatedClassificationNames": 10,
                    "__labels": 11,
                    "__customAttributes": 12,
                }
                this.systemAttrArr = _.sortBy(this.systemAttrArr, function(obj) {
                    return sortMap[obj.name]
                })
                _.each(this.systemAttrArr, function(obj) {
                    var returnObj = that.getObjDef(obj, rules_widgets, isGroupView, 'Select System Attribute', true);
                    if (returnObj) {
                        filters.push(returnObj);
                    }
                });
                if (this.type) {
                    var entityDef = this.entityDefCollection.fullCollection.find({ name: that.options.applicableType }),
                        namespaceAttributeDefs = null;
                    if (entityDef) {
                        namespaceAttributeDefs = entityDef.get("namespaceAttributeDefs");
                    }
                    if (namespaceAttributeDefs) {
                        _.each(namespaceAttributeDefs, function(attributes, key) {
                            var sortedAttributes = _.sortBy(attributes, function(obj) {
                                return obj.name;
                            });
                            _.each(sortedAttributes, function(attrDetails) {
                                var returnObj = that.getObjDef(attrDetails, rules_widgets, isGroupView, 'Select Namespace Attribute', true);
                                if (returnObj) {
                                    returnObj.id = key + "." + returnObj.id;
                                    returnObj.label = key + ": " + returnObj.label;
                                    returnObj.data = { 'entityType': "namespace" };
                                    filters.push(returnObj);
                                }
                            });
                        });
                    }
                }
                filters = _.uniq(filters, 'id');
                if (filters && !_.isEmpty(filters)) {
                    this.ui.builder.queryBuilder({
                        plugins: ['bt-tooltip-errors'],
                        filters: filters,
                        select_placeholder: placeHolder,
                        allow_empty: true,
                        conditions: ['AND', 'OR'],
                        allow_groups: true,
                        allow_empty: true,
                        templates: {
                            rule: '<div id="{{= it.rule_id }}" class="rule-container"> \
                                      <div class="values-box"><div class="rule-filter-container"></div> \
                                      <div class="rule-operator-container"></div> \
                                      <div class="rule-value-container"></div></div> \
                                      <div class="action-box"><div class="rule-header"> \
                                        <div class="btn-group rule-actions"> \
                                          <button type="button" class="btn btn-xs btn-danger" data-delete="rule"> \
                                            <i class="{{= it.icons.remove_rule }}"></i> \
                                          </button> \
                                        </div> \
                                      </div> </div>\
                                      {{? it.settings.display_errors }} \
                                        <div class="error-container"><i class="{{= it.icons.error }}"></i>&nbsp;<span></span></div> \
                                      {{?}} \
                                </div>'
                        },
                        operators: [
                            { type: '=', nb_inputs: 1, multiple: false, apply_to: ['number', 'string', 'boolean', 'enum'] },
                            { type: '!=', nb_inputs: 1, multiple: false, apply_to: ['number', 'string', 'boolean', 'enum'] },
                            { type: '>', nb_inputs: 1, multiple: false, apply_to: ['number', 'string', 'boolean'] },
                            { type: '<', nb_inputs: 1, multiple: false, apply_to: ['number', 'string', 'boolean'] },
                            { type: '>=', nb_inputs: 1, multiple: false, apply_to: ['number', 'string', 'boolean'] },
                            { type: '<=', nb_inputs: 1, multiple: false, apply_to: ['number', 'string', 'boolean'] },
                            { type: 'contains', nb_inputs: 1, multiple: false, apply_to: ['string'] },
                            { type: 'begins_with', nb_inputs: 1, multiple: false, apply_to: ['string'] },
                            { type: 'ends_with', nb_inputs: 1, multiple: false, apply_to: ['string'] },
                            { type: 'is_null', nb_inputs: false, multiple: false, apply_to: ['number', 'string', 'boolean', 'enum'] },
                            { type: 'not_null', nb_inputs: false, multiple: false, apply_to: ['number', 'string', 'boolean', 'enum'] }
                        ],
                        lang: {
                            add_rule: 'Add filter',
                            add_group: 'Add filter group',
                            operators: {
                                not_null: 'is not null'
                            }
                        },
                        icons: {
                            add_rule: 'fa fa-plus',
                            remove_rule: 'fa fa-times',
                            error: 'fa fa-exclamation-triangle'
                        },
                        rules: rules_widgets
                    }).on("afterCreateRuleInput.queryBuilder", function(e, rule) {
                        rule.error = null;
                        if (rule.operator.nb_inputs && rule.filter.id === "__customAttributes") {
                            rule.$el.addClass("user-define");
                        } else if (rule.$el.hasClass("user-define")) {
                            rule.$el.removeClass("user-define");
                        }
                    }).on('validationError.queryBuilder', function(e, rule, error, value) {
                        // never display error for my custom filter
                        var errorMsg = error[0];
                        if (that.queryBuilderLang && that.queryBuilderLang.errors && that.queryBuilderLang.errors[errorMsg]) {
                            errorMsg = that.queryBuilderLang.errors[errorMsg];
                        }
                        rule.$el.find(".error-container span").html(errorMsg);
                    });
                    var queryBuilderEl = that.ui.builder.data("queryBuilder");
                    if (queryBuilderEl && queryBuilderEl.lang) {
                        this.queryBuilderLang = queryBuilderEl.lang;
                    }
                    this.$('.rules-group-header .btn-group.pull-right.group-actions').toggleClass('pull-left');
                } else {
                    this.ui.builder.html('<h4>No Attributes are available !</h4>')
                }
            }
        });
    return QueryBuilderView;
});