export default {

    name: 'age',
    parameter: 18,
    message: "Idade insuficiente",
    async: false,
    fn: (value, parameter) => {
        const date = new Date();
        const actualYear = date.getFullYear();
        const birthYear = value.substring(6);
        const birthMonth = value.substring(3, 5);
        const birthDay = value.slice(0, 2);

        if (actualYear - birthYear < Number(parameter)) {
            return false;
        } else if (actualYear - birthYear > Number(parameter)) {
            return true;
        } else if (actualYear - birthYear == Number(parameter)) {
            if (actualMonth > birthMonth) {
                return true;
            } else if (actualMonth < birthMonth) {
                return false;
            } else if (actualMonth == birthMonth) {
                if (actualDay > birthDay || actualDay == birthDay) {
                    return true;
                } else if (actualDay < birthDay) {
                    return false;
                }
            }
        }
    }

}

