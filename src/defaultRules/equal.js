

export default {

    name: 'equal',
    parameter: null,
    message: "Campo inválido",
    async: false,
    fn: (value, parameter) => {
        let isEqual = true;
        if(typeof parameter === "object") {
            parameter.forEach(p => {
                if(!value.includes(p)) {
                    isEqual = false;
                }
                if(parameter.length !== value.length) {
                    isEqual = false;
                }
            })
            
        } else {
            if(value !== parameter) {
                isEqual = false;
            }
        }

        return isEqual;
    }

}