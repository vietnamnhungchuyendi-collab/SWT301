export const mockQueries = [];
export const mockQuery = jest.fn();
export const mockInputs = [];
export const mockPool = {request: jest.fn(() => {
 const inputs = {}; mockInputs.push(inputs);
 const request = {input: jest.fn((name,type,value) => {inputs[name]=value;return request;}),
 query: jest.fn(text => {mockQueries.push({text,inputs});return mockQuery(text,inputs);})};
 return request;
})};
export const mockSql = {VarChar:'varchar',NVarChar:'nvarchar',Int:'int',DateTime:'datetime'};
export function resetDb() {mockQueries.length=0;mockInputs.length=0;mockQuery.mockReset();mockPool.request.mockClear();mockQuery.mockResolvedValue({recordset:[]});}
export function response() {const res={status:jest.fn(),json:jest.fn()};res.status.mockReturnValue(res);res.json.mockReturnValue(res);return res;}
