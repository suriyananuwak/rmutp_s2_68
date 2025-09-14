
const SECURITY_KEY = "1234";
export const encode = () => {
    console.log("encode function called");
    // Add your encoding logic here
    return "encoded data";
};

export const decode = () => {
    console.log("decode function called");
    // Add your decoding logic here
    return "decoded data";  
};

export default { encode, decode };