import constants from './constants';
import FormValidatorRule from './FormValidatorRule';
import Logger from './Logger';
import VMasker from 'vanilla-masker';
import { deepSpread } from 'deep-spread';


const parseHTML = (htmlString) => {
    const parser = new DOMParser();
    return parser.parseFromString(htmlString.trim(), 'text/html').body.firstChild;

} 
const removeUndefinedObjectKeys = (obj) => {
    Object.keys(obj).forEach(key => {
        if (obj[key] === undefined) {
            delete obj[key];
        }
    });
    return obj
};

export default class FormValidatorField {

    constructor(fieldObject, debug=false) {

        this._logger = new Logger(debug);

        if(!fieldObject._validator.$form.querySelectorAll('[name="'+fieldObject.name+'"]').length) {
            return;
        }

        this._validator = fieldObject._validator;

        this.name = fieldObject.name;
        this.group = fieldObject.group;
        this.elements = Array.from(fieldObject._validator.$form.querySelectorAll('[name="'+fieldObject.name+'"]'));
        
        this.interactive = (fieldObject.interactive !== undefined) ? fieldObject.interactive : true;
        this.mask = fieldObject.mask;
        this.dependencyRules = fieldObject.dependencyRules;
        this.useRules = (fieldObject.useRules !== undefined) ? fieldObject.useRules : true;
        
        this.rules = fieldObject.rules || [];
        this.events = fieldObject.events;
        this.fieldRenderPreferences = fieldObject.fieldRenderPreferences;
        this.resetFieldValidationOnChange = fieldObject.resetFieldValidationOnChange;
        this.validateFieldOnInput = fieldObject.validateFieldOnInput;
        this.validateFieldOnBlur = fieldObject.validateFieldOnBlur;
        this.validateFieldOnChange = fieldObject.validateFieldOnChange;
        
        this._disabled = false;
        this.disabled = (fieldObject.disabled !== undefined) ? fieldObject.disabled : false;

        this.getValueFn = fieldObject.getValueFn;
        this.setValueFn = fieldObject.setValueFn;
        this.focusFn = fieldObject.focusFn;
        this.disableFn = fieldObject.disableFn;
        this.enableFn = fieldObject.enableFn;
        this.formResetFn = fieldObject.formResetFn;

        this.register();

    }

    getFieldRenderPreferences() {
        let fieldRenderPreferences = this._validator.fieldRenderPreferences;
        
        if(this.fieldRenderPreferences !== undefined) {
            fieldRenderPreferences = deepSpread(this.fieldRenderPreferences, this._validator.fieldRenderPreferences);
        }
        
        return fieldRenderPreferences
    }

    getEvents() {
        let events
        if(this.events !== undefined) {
            events = {...this._validator.events, ...removeUndefinedObjectKeys(this.events)}
        } else {
            events = this._validator.events
        }
        
        return events
    }

    getOptionFromFieldOrRoot(optionKey) {
        if(this[optionKey] === undefined) {
            if(this._validator[optionKey]) {
                return this._validator[optionKey]
            } else {
                return undefined
            }
        } else {
            return this[optionKey]
        }
    }

    register() {
        
        if(this.registered) {
            return
        }

        var unregisterFns = [];

        this.registered = true;
        this.status = undefined;
        this._status = undefined;
        this.message = undefined;
        this.validationAppendedElements = [];

        var fieldRenderPreferences = this.getFieldRenderPreferences()
        if(fieldRenderPreferences.wrapperClass && fieldRenderPreferences.wrapperClass.length) {
            this.$wrapper = this.elements[0].closest('.'+fieldRenderPreferences.wrapperClass)
        } else {
            this.$wrapper = undefined
        }
        
        let events = this.getEvents();
        this.elements.forEach($field => {

            $field.setAttribute(constants.INITIALIZED_FIELD_DATA_ATTRIBUTE, "true");
            
            if($field.hasAttribute("readonly")) {
                $field.setAttribute("data-originally-readonly", "")
            }

            if($field.hasAttribute("disabled")) {
                this.disabled = true            
            }
            
            let isRadioOrCheckbox = false;
            if($field.getAttribute("type") === "radio" || $field.getAttribute("type") === "checkbox") {
                isRadioOrCheckbox = true;
            }

            let isSelect = false;
            if($field.tagName.toLowerCase() === "select") {
                isSelect = true;
            }

            let isFile = false;
            if($field.tagName.toLowerCase() === "file") {
                isFile = true;
            }

            let isTypeHidden = false;
            if($field.hasAttribute("type") && $field.getAttribute("type") === "hidden") {
                isTypeHidden = true;
            }

            let handleFieldInput = (e) => {
                this._validator.hasChangedSinceLastSubmission = true;
                this.status = undefined;
                this._status = undefined;

                if(this.getOptionFromFieldOrRoot("resetFieldValidationOnChange") || ((isSelect || isFile) && this.getOptionFromFieldOrRoot("validateFieldOnBlur"))) {
                    this.setUnvalidated();
                }
            
                // Validate selects because their change should also be understood as a blur
                if((isSelect || isFile) && this.getOptionFromFieldOrRoot("validateFieldOnBlur")) {
                    let validate = () => {
                        this._validate().then((message) => {
                        }).catch((message) => {
                        }).finally(() => {
                            $field.focus()
                        })
                    }
                    validate()
                }
                
                (events && events.onFieldInput) && (events.onFieldInput(this));

            }



            var timeoutBlur;
            let handleFieldValidationOnBlur = () => {
                if(this.getOptionFromFieldOrRoot("validateFieldOnBlur") && this.interactive) {
                    let validate = () => {
                        this._validate().then((message) => {
                        }).catch((message) => {
                        })
                    }
                    clearTimeout(timeoutBlur);
                    timeoutBlur = setTimeout(validate, 1)
                    validate()
                }
            }

            var timeoutChange;
            let handleFieldValidationOnChange = () => {
                this._validator.hasChangedSinceLastSubmission = true;
                if((this.getOptionFromFieldOrRoot("validateFieldOnChange") || (isRadioOrCheckbox && this.getOptionFromFieldOrRoot("validateFieldOnBlur"))) && this.interactive) {
                    let validate = () => {
                        this._validate().then((message) => {
                        }).catch((message) => {
                        }).finally(() => {
                            $field.focus()
                        })
                    }
                    clearTimeout(timeoutChange);
                    timeoutChange = setTimeout(validate, 1)
                }

                (events && events.onFieldChange) && (events.onFieldChange(this));

            }

            $field.addEventListener('input', handleFieldInput);        
            $field.addEventListener('change', handleFieldValidationOnChange);
            $field.addEventListener('blur', handleFieldValidationOnBlur);
            unregisterFns.push(() => {
                $field.removeEventListener('input', handleFieldInput);
                $field.removeEventListener('change', handleFieldValidationOnChange);
                $field.removeEventListener('blur', handleFieldValidationOnBlur);

                $field.removeAttribute(constants.INITIALIZED_FIELD_DATA_ATTRIBUTE);
            })

        })

        if(this.mask) {
            this.setMask(this.mask)
        }
        
        if(this.disabled) {
            this.disable(false);
        }

        this.unregister = () => {
            this.setUnvalidated();
            unregisterFns.forEach(fn => {
                fn()
            })
            this.unsetMask()
            this.registered = false;

            delete this._validator.fields[this.name]
        }

        return this
    
    }

    getValue() {

        if(this.getValueFn && typeof this.getValueFn === 'function') {
            return this.getValueFn(this)
        } else {
    
            if(this.elements.length > 1) {
                let value = [];
                if(this.elements[0].getAttribute("type") === "radio" || this.elements[0].getAttribute("type") === "checkbox") {
                    this.elements.forEach($field => {
                        if($field.checked) {
                            value.push($field.value)
                        }
                    })
                }
                
                if(value.length === 0) {
                    return ''
                } else {
                    return (value.length === 1)?value[0]:value
                }

            } else {
                if(this.elements[0].getAttribute("type") === "radio" || this.elements[0].getAttribute("type") === "checkbox") {
                    return (this.elements[0].checked)?this.elements[0].value:''
                } else {
                    return this.elements[0].value
                }
            }
        }
        
        
    }

    setValue(value) {

        if(this.setValueFn && typeof this.setValueFn === 'function') {
            this.setValueFn(this, value);
            
            this._validator.updateDependencyRules = this._validator.updateDependencyRules.bind(this)
            setTimeout(this._validator.updateDependencyRules, 1)
            
        } else {

            if(typeof value === "object") {
                this.elements.forEach(($field, i) => {
                    if($field.getAttribute("type") === "radio" || $field.getAttribute("type") === "checkbox") {
                        if(value.includes($field.value)) {
                            $field.checked = true
                        } else {
                            $field.checked = false
                        }
                    } else {
                        if(!value[i]) {
                            value[i] = ""
                        }
                        $field.value = value[i]
                    }
                })
            } else {
                this.elements.forEach(($field, i) => {
                    if($field.getAttribute("type") === "radio" || $field.getAttribute("type") === "checkbox") {
                        if(value === $field.value) {
                            $field.checked = true
                        } else {
                            $field.checked = false
                        } 
                    } else {
                        if(!value) {
                            value = ""
                        }
                        $field.value = value
                    }
                })
            }

            this._validator.updateDependencyRules();
            
        }

        if(this.mask) {
            this.setMask(this.mask)
        }

        this._validator.hasChangedSinceLastSubmission = true;

                
    }
    
    isValid() {

        if(!this.useRules) {
            return true;
        }

        if((this._status !== undefined && (this._status) === 1)) {
            return true
        }

        return false;

    }

    disableRules() {
        this.useRules = false;
    }
    enableRules() {
        this.useRules = true;
    }

    getRules() {
        let rules = []
        this.rules.forEach(ruleObject => {
            if(typeof ruleObject === "string") {
                if(ruleObject.indexOf(":") !== -1) {
                    ruleObject = {
                        name: ruleObject.split(":")[0],
                        parameter: ruleObject.split(":")[1]
                    }
                } else {
                    ruleObject = {
                        name: ruleObject
                    }
                }
                
            }
            if(this._validator.defaultRules[ruleObject.name]) {
                ruleObject = {...this._validator.defaultRules[ruleObject.name], ...removeUndefinedObjectKeys(ruleObject)}
            }
            let rule = new FormValidatorRule(ruleObject);
            rules.push(rule)
        })
        return rules
    }

    setMask(pattern) {
        if(!pattern) {
            pattern = this.mask
        }
        if(!pattern) {
            return;
        }
        this.unsetMask()
        if(pattern === "money") {
            VMasker(this.elements).maskMoney({
                precision: 2,
                separator: ',',
                delimiter: '.',
                zeroCents: false
            });
        } else {
            VMasker(this.elements).maskPattern(pattern);
        }


    }

    unsetMask() {
        if(VMasker(this.elements)) {
            VMasker(this.elements).unMask(); 
        }
    }

    handlePreventingDefault(e) {
        e.preventDefault();
    }

    disable(unvalidate=true) {
        if(this._disabled) {
            return;
        }

        var fieldRenderPreferences = this.getFieldRenderPreferences()

        if(fieldRenderPreferences.wrapperDisabledClass) {
            this.$wrapper.classList.add(fieldRenderPreferences.wrapperDisabledClass);
        }
        this._disabled = true;
        this.disableInteraction()
        this.elements.forEach($field => {
            if(fieldRenderPreferences.disabledClass) {
                $field.classList.add(fieldRenderPreferences.disabledClass);
            }
            $field.setAttribute("disabled","disabled");
        })
        if(unvalidate) {
            this.setUnvalidated()
        }
        if(this.disableFn) {
            this.disableFn(this)
        }
    }

    enable(unvalidate=true) {
        if(this.disabled || !this._disabled) { 
            return;
        }

        var fieldRenderPreferences = this.getFieldRenderPreferences()

        if(fieldRenderPreferences.wrapperDisabledClass) {
            this.$wrapper.classList.remove(fieldRenderPreferences.wrapperDisabledClass);
        }
        
        this._disabled = false;
        this.enableInteraction()
        this.elements.forEach($field => {
            if(fieldRenderPreferences.disabledClass) {
                $field.classList.remove(fieldRenderPreferences.disabledClass);
            }
            $field.removeAttribute("disabled");
        })
        if(unvalidate) {
            this.setUnvalidated()
        }
        if(this.enableFn) {
            this.enableFn(this)
        }
    }

    // Enable/disable field interaction
    disableInteraction() {        
        if(!this.interactive) {
            return
        }

        this.elements.forEach($field => {
            $field.setAttribute("readonly","readonly");
            $field.addEventListener("input", this.handlePreventingDefault)
            $field.addEventListener("click", this.handlePreventingDefault)
        })
        if(this.disableInteractionFn) {
            this.disableInteractionFn(this)
        }
        this.interactive = false;
    }

    enableInteraction() {

        if(this.interactive || this.disabled || this._disabled) {
            return
        }
        
        this.elements.forEach($field => {            
     
            if(!$field.hasAttribute("data-originally-readonly")) {
                $field.removeAttribute("readonly");
            }
            $field.removeEventListener("input", this.handlePreventingDefault)
            $field.removeEventListener("click", this.handlePreventingDefault)

        })
        if(this.enableInteractionFn) {
            this.enableInteractionFn(this)
        }
        this.interactive = true;
        
    }

    focus() {
        this.elements[0].focus()
        
        if(this.focusFn) {
            this.focusFn()
        } else {
        }            

        this.$wrapper.dispatchEvent(new CustomEvent('formValidatorFieldFocus', {detail: {formValidatorField: this}}))
        
    }

    _setFieldValidationStatus(statusName, message, silentMode=false) {

        var capitalizedStatusName = statusName.charAt(0).toUpperCase() + statusName.slice(1);

        if(statusName === "validating") {
            this._status = -1;
            this.disableInteraction();
            if(!silentMode) {
                this.status = -1;
            }
        } else if(statusName === "valid") {
            this._status = 1;
            this.enableInteraction();
            if(!silentMode) {
                this.status = 1;
            }
        } else if(statusName === "invalid") {
            this._status = 0; //invalid 
            this.enableInteraction();
            if(!silentMode) {
                this.status = 0; //invalid 
            }
        } else {
            this._status = undefined; //unvalidated 
            this.enableInteraction();
            if(!silentMode) {
                this.status = undefined; //unvalidated 
            }
        }

        this.message = message;

        if(!silentMode) {

            this.removeValidationAppendedElements();

            var fieldRenderPreferences = this.getFieldRenderPreferences()

            if(fieldRenderPreferences["add"+capitalizedStatusName+"Class"]) {
                this.elements.forEach($field => {
                    if(typeof this.getValue() === "object" && this.getValue().length > 0) {
                        if(this.getValue().includes($field.value)) {
                            $field.classList.add(fieldRenderPreferences[statusName+"Class"]);
                        }
                    } else {
                        $field.classList.add(fieldRenderPreferences[statusName+"Class"]);
                    }
                    
                })
            }

            if(fieldRenderPreferences["addWrapper"+capitalizedStatusName+"Class"]) {
                this.$wrapper.classList.add(fieldRenderPreferences["wrapper"+capitalizedStatusName+"Class"]);
            }

            if(fieldRenderPreferences["show"+capitalizedStatusName+"Message"] && message) {
                if(typeof message === "function") {
                    this.message = message()
                } else {
                    this.message = message;
                }

                if(!message.length) {
                    return;
                }
                
                let messageHTML = fieldRenderPreferences[statusName+"MessageHTML"].replace("{{message}}", message);
                let $message = parseHTML(messageHTML);
                
                if(fieldRenderPreferences["message"+capitalizedStatusName+"Class"]) {
                    $message.classList.add(fieldRenderPreferences["message"+capitalizedStatusName+"Class"]);
                }   
                
                if(fieldRenderPreferences.messageWrapperNode) {
                    fieldRenderPreferences.messageWrapperNode.appendChild($message);
                } else if(fieldRenderPreferences.messageWrapperNodeId && document.getElementById(fieldRenderPreferences.messageWrapperNodeId)) {
                    document.getElementById(fieldRenderPreferences.messageWrapperNodeId).appendChild($message);
                } else {
                    this.$wrapper.appendChild($message);
                }
                this.validationAppendedElements.push($message);
            }
            
        }

    }


    // Set states
    setUnvalidated(message, silentMode) {

        if(!message || !message.length) {
            message = this.getFieldRenderPreferences().unvalidatedMessage;
        }
        this._setFieldValidationStatus("unvalidated", message, silentMode); 
    }
    setValidating(message, silentMode) {
        this._setFieldValidationStatus("validating", message, silentMode); 
    }
    setValid(message, silentMode) {
        this._setFieldValidationStatus("valid", message, silentMode) 
    }
    setInvalid(message, silentMode) {
        this._setFieldValidationStatus("invalid", message, silentMode) 
    }
    resetValidation(message) {
        this.setUnvalidated(message);
    } 

    
    removeValidationAppendedElements() {
        
        let fieldRenderPreferences = this.getFieldRenderPreferences()

        this.$wrapper.classList.remove(fieldRenderPreferences.wrapperUnvalidatedClass);
        this.elements.forEach($field => {
            $field.classList.remove(fieldRenderPreferences.unvalidatedClass);
        })
        this.$wrapper.classList.remove(fieldRenderPreferences.wrapperValidatingClass);
        this.elements.forEach($field => {
            $field.classList.remove(fieldRenderPreferences.validatingClass);
        })
        this.$wrapper.classList.remove(fieldRenderPreferences.wrapperValidClass);
        this.elements.forEach($field => {
            $field.classList.remove(fieldRenderPreferences.validClass);
        })
        this.$wrapper.classList.remove(fieldRenderPreferences.wrapperInvalidClass);
        this.elements.forEach($field => {
            $field.classList.remove(fieldRenderPreferences.invalidClass);
        })

        this.validationAppendedElements.forEach(validationAppendedElement => {
            validationAppendedElement.remove()
        })
        this.validationAppendedElements = [];
    }


    validate(cb=()=>{}) {
    
        this._validate().then((x) => {cb(true)}).catch((x) => {cb(false)})

    }

    _validate(silentMode=false) {

        var fieldRenderPreferences = this.getFieldRenderPreferences()

        let validatingMessage = fieldRenderPreferences.validatingMessage;
        let validMessage = fieldRenderPreferences.validMessage;

        if(!this.useRules) {
            return new Promise((resolve, reject) => {
                resolve()
            })
        }

        if(this._status === -1) {
            this._logger.logWarning("validate(): Field \"#"+this.name+"\" is still being validated");
            return new Promise((resolve, reject) => {
                this.setValidating(validatingMessage, silentMode);
                reject()
            })
        }

        if(this._status === 1 || this._status === 0) {
            let status = this._status;
            this._logger.logWarning("validate(): Field \"#"+this.name+"\" hasn't changed since last validation");
            return new Promise((resolve, reject) => {
                if(status === 1) {
                    this.setValid(validMessage, silentMode);
                    resolve()
                } else {
                    this.setInvalid(this.message, silentMode);
                    reject()
                }
            })
        }


        this._logger.log("validate(): Field \"#"+this.name+"\" will be validated", this);

        var events = this.getEvents();

        (events && events.onBeforeValidateField) && (events.onBeforeValidateField(this));

        this.setValidating(validatingMessage, silentMode);

        let handleValidationPromise = async (resolveValidationPromise, rejectValidationPromise) => {
            
            var value = this.getValue()
            var rules = this.getRules();

            var isValid = true;

            function runRuleTest(rule, value) {
                return rule.test(value);
            } 

            for (const rule of rules) {

                if(!isValid) {
                    break;
                }

                await runRuleTest(rule, value).then(() => {}).catch((message) => {
                    
                    isValid = false;
                    this._logger.log("validate(): Field \"#"+this.name+"\" is not valid", this);
                    this.setInvalid(message, silentMode);
                    rejectValidationPromise();
                         
                });

            }

            if(isValid) {
                this._logger.log("validate(): Field \"#"+this.name+"\" is valid", this);
                this.setValid(validMessage, silentMode);
                resolveValidationPromise();
                
            }

            this._validator.updateDependencyRules();
            this._validator.updateFormState();
            
            (events && events.onValidateField) && (events.onValidateField(this));

            this.$wrapper.dispatchEvent(new CustomEvent('formValidatorFieldValidate', {detail: {formValidatorField: this}}))
            

        }


        return new Promise(handleValidationPromise);

    }


}
