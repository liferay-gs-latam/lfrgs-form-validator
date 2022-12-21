import constants from './constants';
import defaultRules from './defaultRules'
import FormValidatorRule from './FormValidatorRule';
import FormValidatorField from './FormValidatorField';
import Logger from './Logger';
import { deepSpread } from 'deep-spread';

const debounce = (func, wait, immediate) => {
    var timeout;
    if(wait == undefined && wait == ""){
        wait = 250;
    };
    return () => {
        var context = this, args = arguments;
        var later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        var callNow = immediate && !timeout;
        console.log('debounce clear!');
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
};

var DEFAULT_RULES = defaultRules;
var DEFAULT_OPTIONS = constants.DEFAULT_OPTIONS;

const removeUndefinedObjectKeys = (obj) => {
    Object.keys(obj).forEach(key => {
        if (obj[key] === undefined) {
            delete obj[key];
        }
    });
    return obj
};
export default class FormValidator {

    static setDefaultOptions(options) {
        DEFAULT_OPTIONS = deepSpread(options, DEFAULT_OPTIONS);
    }

    static setDefaultRules(rules) {
        rules.forEach(rule => {
            if(!rule.name) {
                return false;
            }
            if(DEFAULT_RULES[rule.name]) {
                rule = deepSpread(rule, DEFAULT_RULES[rule.name])   
            }
            DEFAULT_RULES[rule.name] = rule;
        })

    }
    
    constructor(formId, options={}, commonOptions={}) {
        this._logger = new Logger(options.debug);
        this._logger.log("constructor(): New validator instance");
        
        let _options = deepSpread(commonOptions, DEFAULT_OPTIONS);
        this.options = deepSpread(options, _options);
        this.formId = formId;

        if(!document.getElementById(formId)) {
            this._logger.logError("constructor(): Couldn't find form element \"#"+formId+"\"");
            
            return false;

        } else {
            this._logger.log("constructor(): Validator will be initialized to \"#"+formId+"\"");

            !window.formValidator_instances && (window.formValidator_instances = {})
            window.formValidator_instances[this.formId] && window.formValidator_instances[this.formId].destroy();
            window.formValidator_instances[this.formId] = this;
            
            return this.init();
            
        }
        
    }


    init() {
        this._logger.log("init(): Initializing validator...");   

        this.initialized = false;
        this.$form = document.getElementById(this.formId);
        
        this.fieldRenderPreferences = this.options.fieldRenderPreferences;

        this.events = this.options.events;
        this.validateFieldOnInput = this.options.validateFieldOnInput;
        this.validateFieldOnBlur = this.options.validateFieldOnBlur;
        this.validateFieldOnChange = this.options.validateFieldOnChange;
        this.resetFieldValidationOnChange = this.options.resetFieldValidationOnChange;
        this.submitFn = this.options.submitFn;
        this.showLoadingFn = this.options.showLoadingFn;
        this.hideLoadingFn = this.options.hideLoadingFn;
        this.formDisabledClass = this.options.formDisabledClass;
        this.formEnabledClass = this.options.formEnabledClass;
        this.groupWrapperHiddenClass = this.options.groupWrapperHiddenClass;
        this.groupWrapperVisibleClass = this.options.groupWrapperVisibleClass;
        this.enableDataRestore = this.options.enableDataRestore;
        
        this.submitting = false;
        this.hasChangedSinceLastSubmission = true;
        this.fields = {};
        this._repeatables = {};
        this.defaultRules = DEFAULT_RULES;
        
        
        this.updateDependencyRules = debounce(this._updateDependencyRules, 150)
        
        
        // Register Fields
        this._logger.log("init(): Registering fields..."); 
        this.options.fields.forEach(fieldObject => {
            this.registerField(fieldObject);
        }) 

        // Form event handlers
        let formNativeEventsHandlers = {
            submit: (e) => {
                e.preventDefault();
                this.submit(e)
            },
            change: (e) => {
                if(this.enableDataRestore) {
                    this.updateFormState();
                }
                this.hasChangedSinceLastSubmission = true;
                this.updateDependencyRules(true);
            }
        }

        Object.keys(formNativeEventsHandlers).map(key => {
            this.$form.addEventListener(key, formNativeEventsHandlers[key])
        })


        if(this.enableDataRestore) {
            this.applyFormState();
            this.updateFormState();
            this.validate(function(cb) {
                this.updateDependencyRules()
            })
        } else { 
            this.resetForm();
        }

        delete this.options
        delete this.formId
        
        this.initialized = true;

        this._logger.log("init(): Validator has been initialized", this);

        this.events.onInit && (this.events.onInit(this));



        this.destroy = () => {
            this._logger.log("destroy(): Destroying validator...");    
            this.deleteFormState();
            this.resetValidation();
            this.eachField((field) => {
                field.unregister()
            })            

            Object.keys(formNativeEventsHandlers).map(key => {
                this.$form.removeEventListener(key, formNativeEventsHandlers[key])
            })

            this.initialized = false;
        }
        
        
        


    }
    
    registerField(fieldObject) {
        if(this.fields[fieldObject.name]) {
            this.unregisterField(fieldObject.name)
        }

        var _validator = this;

        var _registerField = (obj) => {
            if(!obj.name || !this.$form.querySelector('[name="'+obj.name+'"]')) {
                this._logger.logError("registerField(): Couldn't find a field with name '"+obj.name+"'"); 
            } else {
                obj._validator = _validator;
                this.fields[obj.name] = new FormValidatorField(obj, this._logger.showLogs);
            }
        }

        if(typeof fieldObject.name === "object") {
            fieldObject.name.forEach(fieldName => {
                let obj = fieldObject;
                obj.name = fieldName;
                _registerField(obj);
            })
        } else {
            let obj = fieldObject;
            _registerField(obj);
        }

    }

    unregisterField(fieldName) {
        this.fields[fieldName].unregister()

    }

    eachField(fn) {
        Object.keys(this.fields).forEach(k => {
            return fn(this.fields[k])
        })
        
    }
    
    isValid(fieldsNames=[]) {
        let hasInvalidField = false;

        if(!fieldsNames.length) {
            this.eachField((field) => {
                if(field && !field.isValid()) {
                    hasInvalidField = true;
                }
            }) 
        } else {
            fieldsNames.forEach(fieldName => {
                if(this.fields[fieldName] && !this.fields[fieldName].isValid()) {
                    hasInvalidField = true;
                }
            })
        }

        return !hasInvalidField

    }

    getFirstInvalidField(fieldsNames = []) {
        let firstInvalidField = undefined;
        Object.keys(this.fields).every((k) => {
            let field = this.fields[k];
            if(field._status === 0 && (fieldsNames.length === 0 || fieldsNames.includes(field.name))) {
                firstInvalidField = field;
                return false;
            }
            return true
        })
        return firstInvalidField

    }

    getFirstNotValidField(fieldsNames = []) {
        let firstNotValidField = undefined;
        Object.keys(this.fields).every((k) => {
            let field = this.fields[k];
            if(field._status !== 1 && (fieldsNames.length === 0 || fieldsNames.includes(field.name))) {
                firstNotValidField = field;
                return false;
            }
            return true
        })
        return firstNotValidField
    }

    isValidating() {
        let isValidating = false;
        this.eachField(field => {
            if(field._status === -1) {
                isValidating = true;
            }
        })
        return isValidating
    }
    
    getGroupWrapper(groupName) {
        let $wrapper = this.$form.querySelector('['+constants.GROUP_WRAPPER_DATA_ATTRIBUTE+'="' + groupName + '"]');
        return $wrapper
    }

    getGroupFields(groupName) {
        var fields = [];
        this.eachField(field => {
            if(field.group == groupName) {
                fields.push(field)
            }
        })
        return fields
    }


    getFieldsByWrapperElement($wrapperElement) {
        var _this = this;
        let fields = []; 
        if($wrapperElement) {
            let formElements = $wrapperElement.querySelectorAll("input,textarea,button,select");
            
            Array.from(formElements).map(function($formElement) {
                let formElementName = $formElement.hasAttribute("name") ? $formElement.getAttribute("name") : undefined;
                if(formElementName && _this.fields[formElementName]) {
                    fields.push(_this.fields[formElementName])
                }
            })
            
        }

        return fields

    }


    validate(fieldsNames=[], cb=()=>{}) {
        let v = () => {
            this._validate(fieldsNames).then((x) => {cb(true)}).catch((x) => {cb(false)})
        }
        setTimeout(v,1);

    }

    _validate(fieldsNames=[], silentMode=false) {

        this._logger.log("validate(): Form will be validated");
        this.events.onBeforeValidate && (this.events.onBeforeValidate(this));
        
        let handleValidationPromise = (resolveValidationPromise, rejectValidationPromise) => {
            let fieldsValidationPromises = [];


            if(!fieldsNames.length) {
                this.eachField((field) => {
                    fieldsValidationPromises.push(field._validate(silentMode))
                }) 
            } else {
                fieldsNames.forEach(fieldName => {
                    fieldsValidationPromises.push(this.fields[fieldName]._validate(silentMode))
                })
            }
            
            Promise.all(fieldsValidationPromises).then(() => {
                resolveValidationPromise()
            }).catch(() => {
                rejectValidationPromise()
            }).finally(() => {
                this.lastValidationSerializedFormData = this.getSerializedFormData()
                this.events.onValidate && (this.events.onValidate(this));
            })
        }
        return new Promise(handleValidationPromise);
        
    }
    
    resetValidation(fieldsNames=[]) {

        if(this.submitting || this.isValidating()) {
            return;
        }
        
        if(!fieldsNames.length) {
            this.eachField((field) => {
                field.setUnvalidated();
            }) 
        } else {
            fieldsNames.forEach(fieldName => {
                this.fields[fieldName].setUnvalidated();
            })
        }

        this.updateDependencyRules()
        this._logger.log("resetForm(): Form validation has been reset");
    }

    resetForm() {

        if(this.submitting || this.isValidating()) {
            return;
        }

        this.events.onBeforeReset && (this.events.onBeforeReset(this));

        this.deleteFormState()
        this.$form.reset();
        this.resetValidation()


        if(this._repeatables) {
            Object.keys(this._repeatables).forEach((repeatableInstanceIdentifier) => {
                let repetitionAmount = this._repeatables[repeatableInstanceIdentifier]
                for(let i=0; i<repetitionAmount; i++) {
                    this.removeRepeatable(repeatableInstanceIdentifier)
                }
            })
        }

        this.eachField((field) => {
            if(field.formResetFn) {
                field.formResetFn(field)
            }
        }) 
        
        this._logger.log("resetForm(): Form has been reset");
        this.events.onReset && (this.events.onReset(this));

    }

    deleteFormState() {
        if(window.localStorage['FORMVALIDATOR_FORMDATA_'+this.$form.getAttribute('id')]) {
            delete window.localStorage['FORMVALIDATOR_FORMDATA_'+this.$form.getAttribute('id')]
        }
        
    }

    _updateDependencyRules() {
        
        console.log("updateDependencyRules(): Updating...");

        this._logger.log("updateDependencyRules(): Updating...", this);   

        this.eachField((field) => {

            let fieldValidationPromises = [];
            if(field.dependencyRules && field.dependencyRules.length) {

                let handleValidationPromise = async (resolveValidationPromise, rejectValidationPromise) => {

                    var value = field.getValue()
                    var rules = [];

                    field.dependencyRules.forEach(depRuleObject => {

                        if(depRuleObject.name) {
                            if(depRuleObject.name === "isValid") {
                                let _field = field;
                                depRuleObject.fn = () => {
                                    return _field.isValid()
                                }
                            } else if(depRuleObject.name === "isInvalid") {
                                let _field = field;
                                depRuleObject.fn = () => {
                                    return !_field.isValid()
                                }
                            } else {
                                if(DEFAULT_RULES[depRuleObject.name]) {
                                    Object.keys(depRuleObject).forEach(key => {
                                        if (depRuleObject[key] === undefined) {
                                            delete depRuleObject[key];
                                        }
                                    })
                                    depRuleObject = {...DEFAULT_RULES[depRuleObject.name], ...removeUndefinedObjectKeys(depRuleObject)}
                                }
                            }
                        }

                        if(!depRuleObject.fields){
                            depRuleObject.fields = [];
                        }
                        if(!depRuleObject.groups){
                            depRuleObject.groups = [];
                        }

                        if(!depRuleObject.behavior || !depRuleObject.behavior.length) {
                            depRuleObject.behavior = "hide"
                        }

                        let ruleAndDepRule = [new FormValidatorRule(depRuleObject), depRuleObject];
                        rules.push(ruleAndDepRule)

                    })

                    function runRuleTest(rule, value) {
                        return rule.test(value);
                    } 

                    for (const rule of rules) {

                        let formValidatorRule = rule[0];
                        let depRuleObject = rule[1];
                        let targetFields = this.getDependencyRuleTargetFields(depRuleObject);

                        let unfulfill = () => {

                            depRuleObject.groups.forEach(groupName => {
                                let $groupWrapper = this.getGroupWrapper(groupName);
                                if($groupWrapper) {
//                                     if(depRuleObject.behavior === "hide") {
                                        $groupWrapper.classList.add(this.groupWrapperHiddenClass);
                                        $groupWrapper.classList.remove(this.groupWrapperVisibleClass);
//                                     }
                                }
                            })

                            targetFields.forEach(targetField => {
                                let renderPrefs = targetField.getFieldRenderPreferences();

                                if(depRuleObject.behavior === "hide") {
                                    targetField._hidden = true;
                                    targetField.$wrapper.classList.add(renderPrefs.wrapperHiddenClass);
                                    targetField.$wrapper.classList.remove(renderPrefs.wrapperVisibleClass);
                                }

                                if(depRuleObject.behavior === "disable") {
                                    if(!targetField.disabled) {
                                        targetField.disable()
                                    }
                                }

                                targetField.disableRules()

                            })


                        }
                        let fulfill = () => {

                            depRuleObject.groups.forEach(groupName => {
                                let $groupWrapper = this.getGroupWrapper(groupName);
                                if($groupWrapper) {
//                                     if(depRuleObject.behavior === "hide") {
                                        $groupWrapper.classList.remove(this.groupWrapperHiddenClass)
                                        $groupWrapper.classList.add(this.groupWrapperVisibleClass)
//                                     }
                                }
                            })

                            targetFields.forEach(targetField => {
                                let renderPrefs = targetField.getFieldRenderPreferences();

                                if(depRuleObject.behavior === "hide") {
                                    targetField._hidden = false;
                                    targetField.$wrapper.classList.remove(renderPrefs.wrapperHiddenClass)
                                    targetField.$wrapper.classList.add(renderPrefs.wrapperVisibleClass)
                                } 

                                if(depRuleObject.behavior === "disable") {
                                    if(!targetField.disabled) {
                                        targetField.enable()
                                    }
                                }

                                targetField.enableRules()

                            })

                        }

                        await runRuleTest(formValidatorRule, value).then(() => {
                            this.events.onBeforeShowDependentFields && (this.events.onBeforeShowDependentFields(rule.targetFields));
                            fulfill()
                            this.events.onShowDependentFields && (this.events.onShowDependentFields(rule.targetFields));

                        }).catch((message) => {
                            this.events.onBeforeHideDependentFields && (this.events.onBeforeHideDependentFields(rule.targetFields));
                            unfulfill()
                            this.events.onHideDependentFields && (this.events.onHideDependentFields(rule.targetFields));
                        })

                    }

                    resolveValidationPromise()

                }

                fieldValidationPromises.push(new Promise(handleValidationPromise)) 

            }

            Promise.all(fieldValidationPromises).then(() => {

                if(field.disabled) {
                    field.disable(false)
                }

            }).catch(() => {

            })


        });

        (this._onUpdate) && this._onUpdate();

        
    }
    
    updateFormState() {

        let validationStatuses = {};
        Object.keys(this.fields).forEach(fieldName => {
            if(!this.fields[fieldName]) {
                return;
            }
            let field = this.fields[fieldName];
            validationStatuses[field.name] = {
                _status: field._status,
                status: field.status,
                message: field.message
            }
        })

        window.localStorage.setItem('FORMVALIDATOR_FORMDATA_'+this.$form.getAttribute('id'), JSON.stringify({
            "data": this.getSerializedFormData(),
            "repeatables": this._repeatables,
            "validation": validationStatuses
        }));

    }

    applyFormState() {
        let _storage = window.localStorage['FORMVALIDATOR_FORMDATA_'+this.$form.getAttribute('id')];

        if(_storage) {
            let storage = JSON.parse(_storage);


            if(storage.repeatables) {
                Object.keys(storage.repeatables).forEach((repeatableInstanceIdentifier) => {
                    let repetitionAmount = storage.repeatables[repeatableInstanceIdentifier]
                    for(let i=0; i<repetitionAmount; i++) {
                        this.addRepeatable(repeatableInstanceIdentifier, false)
                    }
                })
            }

            if(storage.data) {
                let serializedForm = storage.data;
                
                this.eachField(field => {
                    
                    let value = "";
                    if(serializedForm[field.name] !== undefined) {
                        value = serializedForm[field.name];
                    }
                    field.setValue(value)

                })

                this.resetValidation()
                this._validate([], true).then(()=>{}).catch(()=>{})
            

            }

        }
        else {
            this.resetValidation()
        }
    }

    handlePreventingDefault(e) {
        e.preventDefault();
    }
    
    disableForm() {
        this.eachField(field => {
            field.disableInteraction()
        })

        if(this.formDisabledClass && this.formDisabledClass.length) {
            this.$form.classList.add(this.formDisabledClass)
        }
        if(this.formEnabledClass && this.formEnabledClass.length) {
            this.$form.classList.remove(this.formEnabledClass)
        }

        this._logger.log("disableForm(): Form has been disabled");
    }
    
    enableForm() {
        this.eachField(field => {
            field.enableInteraction()
        })
        
        if(this.formDisabledClass && this.formDisabledClass.length) {
            this.$form.classList.remove(this.formDisabledClass)
        }

        if(this.formEnabledClass && this.formEnabledClass.length) {
            this.$form.classList.add(this.formEnabledClass)
        }

        this.$form.classList.add()
        this._logger.log("enableForm(): Form has been enabled");
    }

    getDependencyRuleTargetFields(depRuleObject) {
        let fields = []
        depRuleObject.groups.forEach(groupName => {
            let groupFields = this.getGroupFields(groupName)
            groupFields.forEach(groupField => {
                fields.push(groupField)
            })
        })
        depRuleObject.fields.forEach(dependencyRuleFieldName => {
            let dependentField = this.fields[dependencyRuleFieldName];
            fields.push(dependentField)
        })
        return fields
    }

    showLoading() {
        if(this.showLoadingFn !== undefined) {
            this.showLoadingFn(this)
        }
    }

    hideLoading() {
        if(this.hideLoadingFn !== undefined) {
            this.hideLoadingFn(this)
        }
    }

    getFormData() {
        return new FormData(this.$form);
    
    }


    getFieldsValues() {
        let obj = {};

        this.eachField(field => {
            obj[field.name] = field.getValue();
        })
        return obj;

    }

    getSerializedFormData() {
        let obj = {};
        for (let [key, value] of this.getFormData()) {
            if (obj[key]) {
                if (!Array.isArray(obj[key])) {
                    obj[key] = [obj[key]];
                }
                obj[key].push(value);
            } else {
                obj[key] = value;
            }
        }
        return obj;

    }

    hasChangedSinceLastValidation() {
        if(this.lastValidationSerializedFormData) {
            return (JSON.stringify(this.lastValidationSerializedFormData) !== JSON.stringify(this.getSerializedFormData()))
        }
        return true
    }

    _submit() {

        return new Promise((resolve, reject) => {
            this.submit((cb) => {
                if(cb) {
                    resolve()
                } else {
                    reject()
                }
            })
        })

    }

    submit(cb) {

        let _submit = () => {

            this.events.onBeforeSubmit && (this.events.onBeforeSubmit(this));
            
            this._logger.log("submit(): Submitting form", this); 
            
            this.$form.dispatchEvent(new CustomEvent('formValidatorSubmit', {detail: {formValidatorInstance: this}}))

            this.showLoading();

            if(this.submitFn) {
                
                this.disableForm();

                let handleSubmissionCallback = callback => {
                    this.submitting = false
                    this.hideLoading();
                    if(callback) {
                        (cb && cb(true))
                        this.hasChangedSinceLastSubmission = false;
                        this.events.onSubmit && (this.events.onSubmit(this));
                    } else {
                        this.submitting = false
                        this._logger.log("submit(): Form can't be submitted", this); 
                        (cb && cb(false))
                        this.events.onSubmitFail && (this.events.onSubmitFail(this));
                    }
                    this.enableForm();
                    
                }
                this.submitFn(this, handleSubmissionCallback)
                
            } else {
                this.submitting = false;
                this.hideLoading();
                this.$form.submit()
                (cb && cb(true))
                this.hasChangedSinceLastSubmission = false;
                this.events.onSubmit && (this.events.onSubmit(this));
            }
        }

        // Process
        this.events.onTrySubmit && (this.events.onTrySubmit(this));
        
        var _cb = (typeof cb === "function") ? cb : () => {};

        if(this.submitting === true || this.isValidating()) {
            (_cb && _cb(false))
            return;
        } else {
            this.submitting = true

            this._validate().then(() => {
                if(this.isValid()) {
                    _submit()
                } else {
                    this.submitting = false
                    (_cb && _cb(false))
                }
            }).catch(() => {
                this.submitting = false;
                (_cb && _cb(false))
            })
        

        }
        
    }


    getNodeChildrenFieldsNames($wrapper) {
        
        let _fields = {};
        let fields = [];

        Array.from($wrapper.querySelectorAll('['+constants.INITIALIZED_FIELD_DATA_ATTRIBUTE+']')).forEach(node => {
            if(node.hasAttribute('name') && this.fields[node.getAttribute('name')]) {
                _fields[node.getAttribute('name')] = true;
            }
        })


        Object.keys(_fields).forEach((fieldName) => {
            fields.push(fieldName)
        })

        return fields

    }


    addRepeatable(repeatableIdentifier, clearValue=true) { 
        
        var $repeatableWrapper = document.querySelector('['+constants.REPEATABLE_WRAPPER_DATA_ATTRIBUTE+'="'+repeatableIdentifier+'"]');
        var $firstItem = $repeatableWrapper.querySelectorAll('['+constants.REPEATABLE_ITEM_DATA_ATTRIBUTE+']')[0];
        var itemsCount = $repeatableWrapper.querySelectorAll('['+constants.REPEATABLE_ITEM_DATA_ATTRIBUTE+']').length;
        
        var limit = Number($repeatableWrapper.getAttribute(constants.REPEATABLE_LIMIT_DATA_ATTRIBUTE));
        if(limit > 1 && itemsCount >= limit) {
            return
        }

        this._repeatables[repeatableIdentifier] = itemsCount;

        let repeatingFieldsNames = this.getNodeChildrenFieldsNames($firstItem);
        
        let revalidatingFieldsNames = [];
        let unvalidatingFieldsNames = [];

        repeatingFieldsNames.forEach(fieldName => {
            this.fields[fieldName].removeValidationAppendedElements();
            if(this.fields[fieldName].status === 0 || this.fields[fieldName].status === 1 || this.fields[fieldName].status === -1) {
                revalidatingFieldsNames.push(fieldName)
            } else {
                unvalidatingFieldsNames.push(fieldName)
            }
        })

        let $clone = $firstItem.cloneNode(true);
        
        repeatingFieldsNames.forEach((fieldName) => {
            let newFieldName = fieldName+itemsCount;

            let inputs = $clone.querySelectorAll('[name="'+fieldName+'"]');
            inputs.forEach($input => {
                $input.setAttribute('id', $input.getAttribute('id')+itemsCount)
                $input.setAttribute('name', $input.getAttribute('name')+itemsCount)
            })

            let labels = $clone.querySelectorAll('label[for="'+fieldName+'"]');
            labels.forEach($label => {
                if($label.hasAttribute('for')) {
                    $label.setAttribute('for', $label.getAttribute('for')+itemsCount)
                    $label.innerHTML = $label.innerHTML + " ("+(itemsCount+1)+")"

                }
            })

            $repeatableWrapper.appendChild($clone);
            let field = this.registerField({
                ...this.fields[fieldName],
                name: newFieldName,
            });
            if(clearValue) {
                this.fields[newFieldName].setValue('');
            }
            this.fields[newFieldName].setUnvalidated();
            
            
        })
            
        revalidatingFieldsNames.forEach(fieldName => {
            this.fields[fieldName].validate();
        })
        unvalidatingFieldsNames.forEach(fieldName => {
            this.fields[fieldName].setUnvalidated();
        })

        this.updateFormState()

            

    }

    removeRepeatable(repeatableIdentifier, repeatableNumber=-1) {

        var $repeatableWrapper = document.querySelector('['+constants.REPEATABLE_WRAPPER_DATA_ATTRIBUTE+'="'+repeatableIdentifier+'"]');
        var repeatableItems = $repeatableWrapper.querySelectorAll('['+constants.REPEATABLE_ITEM_DATA_ATTRIBUTE+']');

        if(repeatableItems.length <= 1) {
            return 
        }       
        let repeatingFieldsNames;

        if(repeatableNumber !== -1) {
            repeatableNumber = Number(repeatableNumber);
        } else {
            repeatableNumber = repeatableItems.length-1;
        }
        
        repeatingFieldsNames = this.getNodeChildrenFieldsNames(repeatableItems[repeatableNumber]);
        repeatingFieldsNames.forEach(fieldName => {
            this.unregisterField(fieldName)
        })

        repeatableItems[repeatableNumber].remove()
        this._repeatables[repeatableIdentifier] = this._repeatables[repeatableIdentifier]-1;
        if(this._repeatables[repeatableIdentifier] < 1) {
            delete this._repeatables[repeatableIdentifier]
        }
        this.updateFormState()

    }
    
}
