<template>
  <el-card class="p-6">
    <el-alert class="mb-6" type="warning" show-icon :closable="false" description="请在转账留言中附加您的游戏内ID，便于我们统计赞助积分。" />
    <div class="flex flex-col items-center mt-4">
      <div class="flex flex-col md:flex-row items-center mt-4 gap-2 md:gap-6">
        <img class="w-60 h-auto rounded-xl shadow mb-4" src="@/assets/images/sponsor.jpg" alt="Sponsor" />

        <div class="flex flex-col items-center gap-2 md:gap-4">
          <div>Paypal:</div>
        <form action="https://www.paypal.com/cgi-bin/webscr" method="post" target="_top">
          <input type="hidden" name="cmd" value="_s-xclick" />
          <input type="hidden" name="hosted_button_id" value="WBFW36RVEVQ6Y" />
          <input type="hidden" name="currency_code" value="USD" />
          <input type="image" src="https://www.paypalobjects.com/zh_XC/i/btn/btn_paynowCC_LG.gif" border="0"
            name="submit" title="有了PayPal，您可以更安全便捷地在线付款！" alt="立即购买" />
        </form>
        </div>
      </div>

      <h3 class="text-xl font-semibold mb-2">成为我们的赞助者</h3>

      <p class="text-gray-600 text-center">
        感谢您的支持！每一份赞助都是我们持续优化和维护项目的动力。
      </p>
    </div>
  </el-card>
</template>