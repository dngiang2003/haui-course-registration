require("dotenv").config();

const axios = require("axios");
const https = require("https");
const cronJob = require("node-cron");

const { TOKEN, COOKIE } = process.env;

const dataView = ["fid=4802"];
const dataJoin = "class=207697";

const HEADERS = {
  authority: "sv.haui.edu.vn",
  accept: "application/json, text/javascript, */*; q=0.01",
  "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
  cookie: COOKIE,
  origin: "https://sv.haui.edu.vn",
  referer: "https://sv.haui.edu.vn/register/",
  "sec-ch-ua":
    '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Linux"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
  "user-agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "x-app-version": "2.0.0",
  "x-requested-with": "XMLHttpRequest",
};

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

const configViewClass = (data) => ({
  method: "post",
  maxBodyLength: Infinity,
  url: `https://sv.haui.edu.vn/ajax/register/action.htm?cmd=classbymodulesid&v=${TOKEN}`,
  headers: HEADERS,
  data,
  httpsAgent,
});

const configJoinClass = (data) => ({
  method: "post",
  maxBodyLength: Infinity,
  url: `https://sv.haui.edu.vn/ajax/register/action.htm?cmd=addclass&v=${TOKEN}`,
  headers: HEADERS,
  data,
  httpsAgent,
});

const parseResponseData = (response) => {
  const rawData = JSON.stringify(response.data)
    .replace(/\\/g, "")
    .replace(/"\[\{/g, "[{")
    .replace(/\}\]"/g, "}]");

  return JSON.parse(rawData);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const extractClasses = (resData) => {
  const classes = [];
  if (!resData.err && resData.data.length > 0) {
    resData.data.forEach((classInfo) => {
      const {
        Costs: costs,
        IndependentClassID: classId,
        ClassName: classCode,
        CountS: studentNumber,
        ModulesName: className,
        MaxStudent: maxStudent,
        GiaoVien,
      } = classInfo;

      const teacherName = GiaoVien[0]?.Fullname;

      classes.push({
        classId,
        classCode,
        className,
        studentNumber,
        maxStudent,
        teacherName,
        costs,
      });
    });
  }
  return classes;
};

const getDataClass = async (data) => {
  const configView = configViewClass(data);

  try {
    const responseView = await axios.request(configView);
    const resDataView = parseResponseData(responseView);
    const classes = extractClasses(resDataView);

    const vietnamTime = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Ho_Chi_Minh",
    });

    if (classes.length > 0) {
      console.log("Lấy thông tin học phần thành công", vietnamTime);
      console.table(classes);
      for (classInfo of classes) {
        const { classId, classCode, className, studentNumber, maxStudent } =
          classInfo;
        if (+studentNumber < +maxStudent) {
          const configJoin = configJoinClass(`class=${classId}`);
          const responseJoin = (await axios.request(configJoin)).data;
          if (
            responseJoin.err == 0 &&
            responseJoin.Message ==
              "Gửi đơn đăng ký thành công, vui lòng đợi kết quả xử lý!"
          ) {
            console.log(
              `Đã tham gia lớp học ${classCode} - ${className} (${studentNumber}/${maxStudent})`,
              vietnamTime
            );
          }
        }
      }
    } else {
      console.log("Không tìm thấy lớp học nào", vietnamTime);
    }
  } catch (error) {
    console.error("Error fetching class data:", error);
  }
};

const fetchAllDataClasses = async () => {
  for (const data of dataView) {
    await getDataClass(data);
  }
};

cronJob.schedule("*/6 * * * * *", fetchAllDataClasses);
