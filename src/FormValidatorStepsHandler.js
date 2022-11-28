class FormValidatorStepsHandler {

    constructor(options) {

        this.steps = options.steps;
        this.currentStepIndex = undefined;
        this.disabledStepChange = false;
        this.onUpdate = options.onUpdate;
        this.onInit = options.onInit;
        this.enableStrictStepsOrder = options.enableStrictStepsOrder;
        this.submitFn = options.submitFn;
        this.onTrySubmit = options.onTrySubmit;
        this.onSubmit = options.onSubmit
        this.onSubmitFail = options.onSubmitFail;
        this.isSubmitting = false;
        this.currentStepClass = options.currentStepClass || "d-block"; // TODO: deixar configurável  
        this.hiddenStepClass = options.hiddenStepClass || "d-none" // TODO: deixar configurável  
        // this.onBeforeSetStep = options.onSetStep
        this.onSetStep = options.onSetStep

        return this.init()
    }

    init() {

        for(let i = 0; i < this.steps.length; i++) {
            let step = this.steps[i];
            let $stepForm = step.formValidatorInstance.$form;

            let handleStepFormChange = (e) => {
                // this.update()
            }

            step.formValidatorInstance._onUpdate = () => {
                this.update()
            }

            if(step.formValidatorInstance && step.formValidatorInstance.$form) {
                $stepForm.addEventListener("change", handleStepFormChange);

                if(!step.formValidatorInstance.submitFn) {
                    step.formValidatorInstance.submitFn = ((validator, cb) => {
                        cb(true)
                    })
                }
                
            }

            let stepPreviousButtons = $stepForm.querySelectorAll('[data-steps-handler-previous]');
            let stepNextButtons = $stepForm.querySelectorAll('[data-steps-handler-next]');
            let submitButtons = $stepForm.querySelectorAll('[data-steps-handler-submit]');

            stepPreviousButtons.forEach($previousButton => {
                $previousButton.addEventListener('click', e => {
                    e.preventDefault();
                    this.previous()
                })
            })

            stepNextButtons.forEach($nextButton => {
                $nextButton.addEventListener('click', e => {
                    e.preventDefault();
                    this.next()
                })
            })

            submitButtons.forEach($submitButton => {
                $submitButton.addEventListener('click', e => {
                    e.preventDefault();
                    this.submit()
                })
            })

        }

        this.start(); // TODO: if config says it auto starts

        this.update();

        (this.onInit) && this.onInit(this);

        return this
        
    }


    update() {

        for(let i = 0; i < this.steps.length; i++) {
            let step = this.steps[i];
            
            let status;
            let enabled;

            let stepValidator = step.formValidatorInstance;

            if(stepValidator.isValid()) {
                status = 1
            } else if(stepValidator.isValidating()) {
                status = -1
            } else {
                status = 0
            }
            
            if(typeof step.enabled === "function" && !step.enabled()) {
                enabled = true;
            } else {
                enabled = false
            }

            step._state = {
                active: (this.currentStepIndex === i),
                status: status,
                enabled: enabled
            };
            
        }
        
        (this.onUpdate) && this.onUpdate(this);
        
    }
    
    focusStepFirstNotValidField(stepIndex) {
        var firstNotValidField = this.steps[stepIndex].formValidatorInstance.getFirstNotValidField();
        if(firstNotValidField) {
            firstNotValidField.focus()
        }
        
    }

    disableStepChange() {
        this.disabledStepChange = true;
    }
    enableStepChange() {
        this.disabledStepChange = false;
    }

    setStep(stepIndex, focusStepFirstNotValidField=true) {    
        
        if(stepIndex === this.currentStepIndex || this.disabledStepChange || stepIndex < 0 || stepIndex >= this.steps.length || !this.steps[stepIndex]) {
            return;
        }
        let _this = this;
        var lastStepIndex = this.currentStepIndex;
        this.disableStepChange();
        let _setStep = () => {
            this.enableStepChange();
            lastStepIndex = this.currentStepIndex;
            for(const step of this.steps) {
                step.formValidatorInstance.$form.classList.remove(this.currentStepClass);
                step.formValidatorInstance.$form.classList.add(this.hiddenStepClass);
            }
            
            this.steps[stepIndex].formValidatorInstance.$form.classList.remove(this.hiddenStepClass);
            this.steps[stepIndex].formValidatorInstance.$form.classList.add(this.currentStepClass);

            this.currentStepIndex = stepIndex;
            this.steps[stepIndex].formValidatorInstance._hasSubmitted = false;
            this.update()
        
            if(focusStepFirstNotValidField) {
                this.focusStepFirstNotValidField(this.currentStepIndex)
            }
            
            if(this.onSetStep) {
                return this.onSetStep(_this, lastStepIndex)
            }
            return
        }

        this.steps[stepIndex].formValidatorInstance.$form.dispatchEvent(new CustomEvent('formValidatorShowStep', {detail: {currentStep: stepIndex}})) // TODO: maybe this should be inside _setStep

        if(this.enableStrictStepsOrder && this.currentStepIndex !== undefined && stepIndex > this.currentStepIndex) {
            
            let stepsValidationPromises = [];
            for(let i = 0; i < stepIndex; i++) {
                // stepsValidationPromises.push(this.steps[i].formValidatorInstance._validate())
                stepsValidationPromises.push(new Promise((resolve, reject) => {
                    if(this.steps[i].formValidatorInstance._hasSubmitted) {
                        resolve();
                    } else {
                        this.steps[i].formValidatorInstance.submit(submitted => {
                            if(submitted) {
                                this.steps[i].formValidatorInstance._hasSubmitted = true;
                                resolve()
                            } else {
                                reject()
                            }
                        });
                    }
                   
                }))
            }

            Promise.all(stepsValidationPromises).then(() => {
                _setStep()

            }).catch(() => {
                // if(focusStepFirstNotValidField) {
                //     this.focusStepFirstNotValidField(this.currentStepIndex)
                // }
                this.enableStepChange();

            })

            
        } else {
            _setStep()
        }

    }

    next() {
        if(this.steps[this.currentStepIndex + 1]) {
            this.setStep(this.currentStepIndex + 1);
        } else {
            this.submit()
        }
        return;
    }

    previous() {
        this.setStep(this.currentStepIndex - 1);
    }

    reset() {
        for(let i = 0; i < this.steps.length; i++) {
            let step = this.steps[i];
            step.formValidatorInstance.resetForm();
        }
        this.start();
    }

    start() {
        this.setStep(0, false);
    }

    getFormDatas() {
        return this.steps.map(step => {
            return step.formValidatorInstance.getFormData()
        })
    }

    getSerializedFormDatas(concat=false) {
        return this.steps.map(step => {
            return step.formValidatorInstance.getSerializedFormData()
        })
    }


    getFirstInvalidStepIndex() {
        let firstInvalidStepIndex = -1;
        for(let i = 0; i < this.steps.length; i++) {
            let step = this.steps[i];
            if(!step.formValidatorInstance.isValid()) {
                firstInvalidStepIndex = i;
                break;
            }
        }
        return firstInvalidStepIndex;
    }

    submit() {

        (this.onTrySubmit) && this.onTrySubmit(this);

        if(this.isSubmitting) {
            return;
        }
        
        let firstInvalidStepIndex = this.getFirstInvalidStepIndex();

        if(firstInvalidStepIndex !== -1) {
            this.setStep(firstInvalidStepIndex);
            this.steps[firstInvalidStepIndex].formValidatorInstance._validate().then(() => {

            }).catch(() => {
                
            })

        } else {
            
            let _this = this;
            let submitCallback = (result) => {

                _this.isSubmitting = false;
                if(result) {
                    _this.onSubmit(_this);
                    // _this.reset();
                } else {
                    _this.onSubmitFail(_this);
                }
            }
            this.isSubmitting = true;

            

            (this.submitFn) && this.submitFn(this, submitCallback);

        }
        
        

    }


}

export default FormValidatorStepsHandler