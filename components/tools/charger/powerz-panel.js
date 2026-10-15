/* ==========================================================================
   Power-Z Panel — 官方上位机控制台 & 采集数据/PD协议离线可视化分析
   1:1 像素级复刻官方上位机 (ChargerLAB POWER-Z Lab / KM003C / Mtools / PDM):
     1. 控制台: 官方工具快捷启动、目录管理、后台自动存档监测
     2. 数据记录仪 (图2): 1:1 复刻 4列HUD、^折叠、双Y轴波形、双游标(T1/T2)、
        右上角 T1-T2 差值计算看板、左下角 全部/窗口 统计表、
        底部时间轴缩略图、POWER-Z 水印、图1 坐标轴与颜色设置弹窗
     3. PD协议分析仪 (图3): 10列报文表、彩色消息徽章、详细位域解码、
        右下同步电气波形及选中报文垂直指示线
   ========================================================================== */

const PZ_OFFICIAL_ICONS = {
  tab_chart: 'data:image/png;base64,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',
  tab_protocol: 'data:image/png;base64,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',
  tab_powerz_z: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACoAAAAqCAYAAADFw8lbAAAEwElEQVR4nM2Zz2skRRTHv9VVM9M9k51MNmPWg8LCHgR3A0H3IJ6FXVbQiO7B64LCHpY9ePPmH+Bh2YOQgxcvggqLBzEieBBkDxGEjRsVhBxkkTBJxmQy09PT1SXv9fRMz69MT3cS8qAzQ6ar+lPfqnr13muBuH17UIXW9yGwAoPXIEQVZ2d1GPMYwAakfIC3yrX4j6L37dH+ezD47IzhxpsxNQjcxerC14OgBAnxFc6dmdsRrOhO99a5UHLU6tD+Mt6t/mOFa3IMpDHZr+MsWbsKpLpPXxRvnCGTCJDTHn+mNQ0LHZXnz2FAKczE/kfaGcN8KtzdMUijMddp4qK7h3zQSQ3qWTns2RfRyBWhhQz7RoB84MHWbVTc+tj+R9oJcT0EjU07dUSQ1VYNc34TVqAhRGwUCc0YA9uSsEwAgyo/lHqJBCDQvPb493j/49oFQlZC0P5dPB3UEUH+dud1ZLEnO4f44IctuJ0GOpZCPvB7Ary6NIeHN15BMRcqHbftehN3vn/K7VxZgCfDewYWUDg1HUiTfm1GD/voxy0c+IIf5gSdGGQJD29cHQv5rOHiw+828a9rcKSK0LKv49BKz27P+GFPsOP6vN6UCbDQjENeGwu52/Jwb/13bkeDa6sCtOkviz7yCdhu72EaTWWjrWyUvQMUdWsqJA3u7//aaKgibyZP5gcOzgFFySWQClrMLvSh5/ceRpAtVYTTaaLozwZZc8JNNOzW+ooKwf6LRkO7buXzXxLvetqtgbBYBU8VWUmG1C6uzBfw6RsvzwbZdWfjQbuK0o1AFcGMfpRm4rBwATIIutMdQq7dWkbFzmWCHAFlWCHRyJfQtnKznUzGoGA05ts1XpMR5KKTzww5FpRhYUHLQmLG6DRbcHcxdwqQE0HZEp5IDOm3UCVIv3kqkJn9aKRk5MyvnBJkJtBZIJsdjXvrm6khU4OmgXy656aGTAWaBvLXnaNMkDODDkO+WMqdCeRMoMOQS7bkKOgsIBODjoMkJS9X6BQ7fchE0VMmSHsRDeWEAca0ZG+K/1anAikd7DuL8IWEHXjZE8LjQNNCNpWDRr4My/hYcvdnDmyGE8JjQVNDSopDHcx5hww4LoGbZPHEjqI3CoziyqoskNoYfPLzX33IXBGOT8GyiyVb4Yu3r+NSKXlwQ0ZxMIWYFL1xYNQd5ADocLo8DfLjn/7A+vY+Tzcp6fQgJdbeXJ4ZMhSqm2AOhZh9bY3hqYrS5aSQtHEO8mUUfJchLyhw2nF53sFJWk9RKrMU/DYXB2ja1m5dmw6piry7ReCzCheU4EPgpcUSTtp6ikrto+Q38bwtJkMGBPlnD5KcecvK8eDKyjDkyqVyJiBKLDnBHHJRAo/q7Imt7iZ6bkI5J57AUd4duRFqfFy7pMb9W7J/msV3/WpF0NTXqbwXCIkjrhFNTuxopHW70i219B3ztHap/Ghf0Xq3mmceQ4ibSRK73snBFQyRPSFMdjJt0h9SdAPAzeSJnYgzpk4IJ9tI58QHi99AUHF/4F4x+TrOhMh+jb4peRCC0msSegNxPu0u3lnYpi/hYuA3D+Z2tHDPgdUBvI/VypfRPwa1/qb2Ahf3qW4elqS52nuGcLRxNni6u0pG9j/vr62molTYkwAAAABJRU5ErkJggg==',
  tab_ic: 'data:image/png;base64,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',
  menu_btn: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAE5ElEQVR4nO2ZW0wcVRjH/9/sVWgF5JJiSGnQVSkRDaExRuKTL4WaiimtiZjCg6naxssDiSy0We2yoDWYlgdNE59VrGJDBRXTJtakVbRtbCKlJRouxkBF2HZ3u8vuzGdmCZfdndnrLGwafm/nnDnnfP9z/c43wAYbpARBA44d4yKv319HxHVglAKcC0IuGLkAfAx2EpMTYCdAl0Tg63KL6ezevSSuq4CjjjsvE1E9GDsTr803AWGAmD9tazN/t6YC7J2+fZCkQyCqgTZ8IoC6rVbTH2kVYLe7qyHo3gFQC+25RUTdba0muX3tBdi7fLshcS8AI9LLUGG+qe7AAfJrJsDu8HUAbMXa4SYO1LS1bbqSsoAOh7ePgeewDrDBVHa4hf6K9o0QrdDuuNOxXsbLkN931fYBFyCZGXA4vLskoF+pbPNmwn15mlwhQRYWGHPzDK8XSgxM/zP5fE+PxadUqFfK7O1l3fUxX8RpkJ9PeLpGj+3bo05c0oxck/BVX8TerS0qLjkO4BWlOoqWjN7wHQJQtTpPrwd21abPeJnyRwQ8/pgO4RCo6eh7vvK4BHR2zueRgIPh+ZYHBZSUpM/4JXZURwoAYEKAm5UKIiwS+Z6DYFjC8wsKtFvz0SgqUu6HCE02m6ckPD9ySJkbkZkUGgxCfVQB7zo8T4HwMDIUFiKdxhABOtI9o0VHw7+KON6zgB/PB6ApjJ1dXZyjKoCBhlT7mJyS8P1QAC4X4/xPIs6e01aEKHrrFAXYbGwGc0WqHQwPh75RLlwUMfSDdiKYaIfyDGS55ddTSoxPSMHLSOYhy0rTvwyLGPxWGxEEbFudXu7FGDCkLEBeMktUVenQ+KJhOX3psoj+M6mL4DABy66EJIm5EOK/qEavS5ieXhztJcbHF9MVFQIeKFtsSxbx2ed+BALA71dF+AOMgvzQs95i0aF4S9z3jLIAGPSAGGqQGk4n49SX6u+N6qqV27R0q4AX9hlw+nQAt12MkRFJcebefN2I7Oy4RIR8tDzkcuQgLusB5OSQolsh5z9bp48ok0Xs2WPA/cXqBmbHZ7zMhOIMGGF0+qHosSqy/6WV9R0PsvHNTcbgRg+ndGsCPhapCBAEOJFylCY2CRmrAHGogOXWWlrIvRiryWwkxsjqdOhwMH2BDEcU8I2qAAIG1CrOz2NNmJtj1TIC/WxrNf+pKsDvN51TW0bTMxLcbvXGteLaaJSjnDAYnhUiwGYjj9oympnhoDswO5s+EU4nR3X+RNCZmI96NqCbAtwAUKHS7Ts56UdZGSFPy6iEH/hvlnFjLMroM04esRp/C89WtMLu8L0NcCcyCImE6iOtkQIUwyr3bjJ+eMu10ABwSGRCicpKHSofTfxs93igFEJJaPSTDmyt5q03jMjKSm45Xb4iYmAwpocaNbClOnRWq/kMwI5Yrd/8N7lN7fEwpv6OWdcdMJr2qxl/9wd3Zdqs5noGPsJaIwlPxjJeJq7dd9hqfg2EV7EWMEYDBEt7u/FiPJ/HfXy0t5o/BnEjAVNIF4w+vc70hK3VPBZvlYSPD4fjdiGToYklNIOgGHBNGKJ+gfnk4sGRYNVk+zxxgk1Ol6+JCLtT+c0qgE8lY3gaf3QHY0vyw9sc1tVs8DnIfCFjfnRHw/a+a4t+QdjGBp3TLBgnFh9MG9x9/A8ThdJYsOabmAAAAABJRU5ErkJggg==',
  item_subchart: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACcAAAAlCAYAAADBa/A+AAACWklEQVR4nO2YTW4TQRBGX01Pj+04ECLFSJzByxyANQcIV+AYCSfhAByANXtY5gxIiSWTKE4809P+UJsYjROTRbDJWMpbTrX0laqrp37gmcdhfzNIshOw4QNn/pVT0AnIzLTKbquc+gzZDyl35+a9x10b9or18RPYEQqBGAcKb8zqI5jddXLJuWMpG0J+OVLHOnQtpyszH9Dao+cxmRRUM1XJ9OWBladQfzSbLc7kdyKWjy7od/vs1oFeFimCyTls7c5VSF7EmejlfW5GF1wN95hICosI/nEu5dfgjKLYVb+seVF08SHgOkC09eddR6gynO/iypI899LZmYWT19QpVkvOpcQfe5wLVsRc3gLuw9d339kwn95+OSSDpJvyu/kAs+bBwrDQkaVrjLb+q1xF0kl6STfpN21LzrWNjBaT0WIyWkxGi8loMRnb4lwllGpeRHLSyk5h3Thprpd0k37TZs2iP4CdnRvtzyJ7tVG4//AjjpJyUWWOi+uejc/helH8lyLXhzpGqiir89v6tmlyUNJLukl/O3NuArlz6TqV1xvsgJsknaSXdJN+07bclYxx6plPPdy8VYJvbJgCDkvDFWbej3HD/Ye6Ep6oK+G5K1kf2/Na20ZGi8nYqsJfPlHhL+8X/ry5txgEou2qIhLUgRh0WNz+izbhVJWi44mUhOhVhSuLyY/FGbsz8fv5xF/o98SfpYmfjUz8cTHxz6hyz820squDPSZHcH/iTx+OpTqtBC5H1K7D1BzdYkO7kuJ2V2JiOpswPThgvit531jmbM+WqW37uWd4JL8A4DNClH8+WHkAAAAASUVORK5CYII=',
  item_abscurrent: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABxklEQVR4nJWSS2/TQBSFv7EnjmPclrSNk6p5SCzYsOiGX0J+c4AfABsUFEU0KaVpmoed+DUeZKdQ3FZKOdLoakbnnnPn6Ip+v68XiwXhgcfo/QcOnQphHBGlij8wZYVMpSjT5uzbR5rTL8RRyGAwwNhRBKllE7p1WsmcejTHXv38ey7edDmr5VRFXDtCi/s2QFKCxjRNum/f8Wq5ZjG75thrUbFtjuonXF4vcq8SZPkK9QMXQ8Wce6ecex7RNmD94zvHjSZV6T+m80TA0RnMb4ivppj513RGhkIGPpb1er/AdLnG8EPSTUQsKELKSVfA+tThZJ+AAiIBM0MTCqhp6GUGt0I/cS8JiCwnGCyjhFClRXOOrYCxkREJgcZAKFXKUe6Kphrc0hp+YtK9QNtll+C+1lY3HP4aQpY+CGi9G03GG7zhZ+qXX8kM85lhNTLeUgnXYP6zB2EY4rouvu9jJtvi7IPjuARBQG4ux+Mx7XYbx3EQ4tGWPDeH1uSrP5lMyLIMeXd3VzwaxsNY+5AkCbPZDKUUstFo0Ov1qFarLxZYrVaF6WazQXY6neIyn89fLJBn1mw2GY1GGJZlFUr/gzx4KWWR2W9k/86+UlOw7QAAAABJRU5ErkJggg==',
  item_stats: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABqUlEQVR4nJ2SP2/TQBjGf3c+99zEpMIBCnSwyp+CEANIgBjLmDkSYWJDsCLEl0Bi5iPAVPohCAsSGyxpQKIKDHUgJGAV2+dDTtSopg20PNPpfXW/97l7H9FsNu1gMOAwUkqRJAntdhu5U7QILM7MS9/DR+gbT0jnTpXqcgoQLkZ4peawdotfS3cw8ghnVy7RWj0J3uL+gBxFLnWpGV5rcfd2g7y6PCmIvc7kzkGQI2xGVjmHDK6Qy3miuELnx1Hk9fs4XpUkE38D2PFPHLt6j0brIfjLOG6FB415nj0+z8rNBd5/cWcDLBKL4viC5sJpgXQ0gW85UxNcdCX+omQQ73Wgdj9B2hQ7djJBdj4b1t+kzKkhr19VuBwYutP+HwBbPEI4dD58Ys1Ysu1vqOFbnr5Y4ufGS4a1VTaDOt7211kODIkMSDbWedcVxV5xN5+TCo22CSe2upjIw8m22B0XZe3EUmG/mn3kYJrORaZpiueVA/Qvaa3JsoxiuOr1eoRhiO/7BwaMRiOiKBoDRL1et8VlIfaJ2QwZY+j3+8RxPA5neS+H1DRI/6vf/EySlv92+7MAAAAASUVORK5CYII=',
  item_extremes: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAARCAYAAAAougcOAAABhElEQVR4nM2U0WoTURCGv5lNYoSmiRjiEmmhCL0oelVfIi+Q5xCa1+iL9AX0IfROvBDEi5YQNUiLAdNsckbmFIxpNsmmVvCHvdjdmf9j98w/8N/JTOK1pYo1uPE7SgyuduJ9Wh9xzBQRux/IWyvz6apGQoPEDuKzmXxmxiXP6j94KdnfQc7eV6CdUtFDsAboU4K9QO0NyCWT8BH6A7rPJ+tsSmsB1XZKpkeYpMAehB4qu5jVQF+TaIly22vXgmQjQCVFbB+zE0R2f9eYnUVQsAHl8IHx6i/SOwFcIl0InVjjtd4Tf+8miB8yBQCrQN4bPVZBfEx9ivyQiwDyQN7rHreyNId4DqpWj1OkPAZ5tRGwAJp1Yq97uNcfmt9cDKtQaYE+IUx7iDxiG4l2CZahes7FcAhky5AvzTGt730oD0BPCVbaDiJTCN+waZ+vzfHCq9zwqR6S2A4kBQkz3wIjQn44l3Pi0+E76vrn0pSwTg8eZnGn5ayZ/DDeYdPeuBVbmP9EvwDJOqTESEf5KQAAAABJRU5ErkJggg==',
  item_rateboost: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAF6ElEQVR4nM2aWWxUZRTHf+d2ukHnTqEzA6VKaxRQEyNghFCXhBdjAiIP6kPVGGNEH30Qow8uMfFFYsIL7hHFhLjHJS7RAIk2IrjHDcSFxbTYqTBMp9ACvcecmdLSWe+dDtDfQ29773fu/Z9vOd/3na9CFfjlF62bNZeVqlyF0qZCm8AchDZV0o7Q43n0Zq7QC3wUd6W7Gt+WSg2TSZ1xHK5zHK5ToQulIdALlP0Ib3gen81qlk/PmgOJQW3FYw2wBmVOpR/OUfEt8HwsLM8HNz2XwqvgiC8HEkd0BcJ64CLODp8Mw23nufLfpB3oS+ldAi9y9vkbuD7myu+lCjmlHvan9IFzJN64ANj9b0qXUUkL9KX0ToGXmArUMCc2XSz8+muBxIAunzLiARnhy2LP8hzoP6JXomxlCqHQkUjpc2UdsFCpwiamJmsSA/poyTGQKaA8diZV/Nmn7OqBXT3KsRMQC0NLWGhpghnTYGF78cAokASWRV3ZlefA6ET1zZmYpHqS8N63Hjv+VPoHSpd94maHy+eWiO7Cc7Gw3Hvqz9DYA5tlqyx+6IQJV977TkkdU182R4+XKaDckxjQ12Nh2TbmQCqlLcO2RKgiX/6ubN6u7O33J9y3A4ZyH7BtbBAPwQ3VrP3v9ylPfuwFFm8cG8YPq/qO6LwxBxxYSZXY3aus+0g5ebIy+6PH/Tktwmq7hvbs0Xq1FqiW+A89Ukfznz240mF+K3gqvLAtO6ALMb3e9wLZNK8LRWazGqWOCrFQ+Plvyue7lR/3FxZl4q9eMC7s4dUOj7/rsbOAE3NbfH/6mnRaZ4VEWVKhdrb9przarbZuKlqmqZ4J4k+xqEMKOtAe9b/HOuaxJGR72Eo2lhYarSuUIx4p/PJoU/691mZwGwOIENpCoxvwQDzylsd3+/wNtr/6lN5kVtzp/N2XX3ZxRzAl4tHmZLIHAdjU7V/8KV7pnthSO/+Cd76ZeM9tFG68ouT2JA/PWsCawZZ7frDI8caO4LG9e7fy0NGs4MOD8M+h/HfcuFiYk9NKZVHrQkpaoN5P+REv20cdR4iHIepCawTe/rq8Uz8dKF6mI2q1H3wgOsJAyJJNqvgKXp3zhM55NXn3467HM1uCt4wRCkHXMqGhlsB4Sq9jGTMmyYqFDl3LgvVfw50mPLraoXN+Zfk1q/xsC1RgfPwk9Bw6SXJwhObpNXR12rrQYfP28qHVmB2BtSuEBa0VJwexNGXIflTyil8PDJMczIq169AJj67OOtxGh2e3lndi7QpnUuKNGo8ex1PeD2p4KD0yJv4UBw+PMDisrFwkmaVDKWzDMlnxwFBLs3zqzI7IV8DYFs0P+xOFl5rJ9EjmakuHUk5cW2BpERQRXrZr9ivCa34NDybza98I1QiRaeOizYlCAzvuCtdeMnkHPC/bczJfGPH4xK+hDdxcakPCpefX0tRYPhLdfrXQWEHIPB1V/ohH5GP7PfPF2RHZAWRulGJwyNb6E2s/3OCwsKOemU3588Ngzu7q7uUOy6tQ+8J46mesylTYWM4wt+u0hGu4rL2O6Q2FRf30z3iAXtwumeVCFfhjCDbkORAPy5vAF6UsT2THaIaOeG1GfF1tcVHpoawDtywVHr8p+ERXEOXp8yNyKD+tkk3hbRS4hhKY8OZpQnOBLpPLrZ1CU4Ow9MKq1DwIP/SFx2s/eyuHREptLFzPFESUO6IRmZD6zGtXOxkZPVyYUqiyIVe8UbBtEymdb0kGpggCO6OuLC3yrDB2MuJQPC9/Nom5UlRn0dAwy5XtdjIisJdzhMCbpcQbJWObHetEXbGzqsDnt1Xg/qgrt5Qr5Cs4x1y5B+Gx0fz8GUWEn3HoirnylK/yQV7en9KLVbjPUtwVKywu5D87i/aaWB8XSQewC44dAo6muFcxeZIibPY81scjsieo8aSmSEtxj2aJLdFacgbPYUTgA4H30x7vtjfL4Uo1VGmOB0u0Wq7S8kyWMbOkk+VtLPWRyR6M/quNbQNnRtgiIqetrCrnf/2aFRp5WP3KAAAAAElFTkSuQmCC',
  item_measure: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAFx0lEQVR4nM2a2W9UdRTHP3dmoAttKaUznc50WFrEHTGNosYX4oOxYGyhBB98MDFBymowvJhI8S9QByhSH4AYExME44Iv6oNCsGXRULcAhVK7yLSlLG3pQplrztw7dObOTHvvLKUnaWZ6t9/3/M73nPP9/e4ozABTD0X/r7xp/l4bMwx8omMz0gE1Gugq4JUE52aeAwaAa4FPATm6JsE1M8eB73bAtVuw+2shfAi8HygFXMA+K05MuwMCaLkPZtlh5SNUDw7jR8ETcYnbihPT6kAYyIKdcOIia9v62Nt0Bc/QSCgSGJyQqLxmvNdo0bdl0KIA2Ki52kND02XcQ2OwoAheWAJzsmJuCwCbgGOJSuy0RODoVjjfAW8dDE1ZFUH2LCrGvaICcmZB4Db0D8WdzhKgYbJIODIN/vRuuDEEy99Haa6nduwuH8524JVzi4shqEIwCN55gi7uI0r0nLCHIyFOhCORUQrJQJ03oOwd+Gwjr6sqe5eWML9ykZbEFu0asNlIp4w5EA717RHIy6Lm/L8caOnEKTP+hBeeXggOW+pOZCQHzuyG9uuw4wsoyKbKpuBf5sO5rAxsCvzVBb+3w3jQ8qOlOu2P7Nhpd6C5HhQFiuZA3UrWBFUagTK7DZb54Cmfdl6cONsGY/csDyFu2zOSxEKbrhsw2wHft1CtKOxTwb1U0lBG1Z2QXG3pgIsB8BWBtyhhAhvtP2CbNPO0OxDmfH52qJ6vLi3E3xrAfaZNS7QlLm3mhUJCJTkWVKGkwDT4bmA78GXak/jIFm0msxywfIGmbYbv4jl9BVp7oCAHXn5c+7zvsKrhtplD0AFsAb6JBJ+WCByTgAIr3oD+H1gHfAR4cmbDinKNNoW5kJcdfZ9EQzFfebbHAx/6niptzrVD5Utw6DDri+bgf64cl2vuBC2k0tgFbHIjdeucPxoPfEpVKMz5gmwY+JNaVz4f9w7gOnEJArcmpkZqfZLgu4ANk4EPHUvmyc27wFOo0aIwV+P89UE8Jy9B36BGmRcfgpKISFi0AFAHfDUZ+KQicLpe47VwPC+b1brs9czP10AX58HNO3CqFXpvJw1+kxnwlh0Q2gjAynL48W+qf7lAw9AonlAcVQg74cqH/kH4tRWGRi3Tpm4y+Zy0A2HOf94E7b3U2G3sb+vDd+oyhBYkRDvhLtQUZtYsSwn7ttmZv3+NmSf//B6UzYO5OTA/jyoVGq/24W26DHfGoNypgY5UmMNjWkcWupkslVumSth4ZjOzGBkcgYqdMDeXGuCAAl7R8s9XwLxccObHApUcMQm+Q+e8ZfCha6eizW9S5+tRDm9g/VI3/sqFOCNnemBEWwqa7KjxaFOXqEmZMdtUnD94Es59QK2isPefbpznrsLdCAUp2idJ8CLMEnZYsxZ36HsHtROhBqRQNT5OY0sn3j86NQGWwoIkErx02ChhlozFQGjapdXxsne13QNUGh12vKLj5S+8IDlriIRF8JvTAT4mAkIbqR4XrkFHP9WPemiocFEavkhmX3S87DDI98c88MxiSxRK28zHRCDM+T0/wb0gr94cxt98hdJLgQk1ENLyPniyTCuZFinUnW7wYkrMXovC2uFR/Gfa8IiWl1ous/ywrEaZUJh9A1Ccb9qJhHo+VXPE7BKr+HOy8Dxbri0+O66HIhJ9k03rtCaF2qR6PlVTIhxYpW9xl4ZjMzwKPQNaFzbZlCzr+VTNuCKbUC6q1k0XFictibt0bXM8U+DFIuf1uN7SeyKOpaLnt2YavJjN8OAjerJFO5FBPZ+WCMRxYrNes62aZT2fqsU0sgiTNySfAE4LCbthOmgTaVG1xTDgMZ0KvZgrldumG7xYTHE0DCxdc+MUdEpJz6dqCVWMgU61+ksGeYuYVj2fqiVsT3EiYaxOadHzqdqUOtIQiXX6O6txvc6nVZglY0qSPwmQyH37oMGLmVbyCd/TPkDwWNkXirsv+YDBC4b/AbzRy4xeQ5+MAAAAAElFTkSuQmCC',
  item_import: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAABjklEQVR4nO3ZP0tCURjH8e85VASNDVJDiNDUFBgEYSFIEC419IdwK9p7Gzo1RG8gjJTAOYQoaVKIhqZAoqFwcAmCKPDErSWIrkfLzn3qflbP4/P8LucelAOh0P+mbBaZWrmEYgrDaI+nucNQVfHUon1JG6ZWNjig4imrh6v9PjS1cgFHjGVv3wAYZnHF2PX2D6CI4Iqy6+0fQACNcBrhNMJphNMIp10PwElBeIBaGUp78PIsNIDn+gIOstC8R2YAT+MW8lmoXyEzgOfpEY524PIMW30E0fE+PDStlqqu/wvktvgFeQ7rGeX9NhWxhT5bZzVWMWvRKEIDeGZo6YpZjs4hNIAvCQHO0a2EKt6cyjmFOniJuz+Ffkrui9NsegG1vatkbqH5DCSWrJYGawsNDkF6E2IT1iXBCRAZg/QGDI90VBaMAOOT78P3D3Rc6j5APAXJla7L3b/Eye6HD0aAbwoDuKYRTiOcRjjd9s7KFWXXu90NTRVXjF3vv33J9+GLihga9Jp561G0HT4UCsErX+1fHialMY4AAAAASUVORK5CYII=',
  item_export: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAByklEQVR4nO3ZwUsUURzA8e/vt691dcWQIjEPHoq6JOpBpEvYYRE6RKQHL107FXTcP6RT5alLJIgXPayC0SVCD0ldki4GKQUVhKzjstsLDaJL27DO7OOn87nOvN/v/WbmvTfzBjKZk03inLS/vLHg8WPA+ZT7sy3IWkdp+FZiBUTLbzwBFEojsS6uNjsYrWw8J5AoZu6mBXjvrxGIj5m7aQECfQQiMXM3LcACxTjFOMU4xTjFOE0zePTsJSYL8LU61YdLB+9QpM0lHbCx8529xxUaW19oB5dksPrbLapPKvjdiHZxSQWqvXjH3tNV2s0lESSaf8X+4johyJG+Bbw/fN5rrzdJW9/HWUn0Dvz8+oPqowqNDzuE5FppVH//6fdg/bZLaIpx2kojd3mA7vIUuYv9mL0DeqbnsIj8+CVCckdqLULn3UnkbM8/p9HTs/dT3ZnQlqP/nej2VTrvXMf0IM5PXKH44CbSXcDsLOSGBimWp8kNnsPsNJrr76VYnuLU6AXMrgOSd3Tdu0FHaRjTC1lhJv2NPcU4xTjFOMU4xTjlmBew3aZ+tJz7Pz84ZI1AJGbu4/2T708gkTkPn0mZP8ghMhe385lMBn4BT8p1QMy0d60AAAAASUVORK5CYII=',
  item_savepic: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAEZklEQVR4nO2Zf0zUZRzHX587GBVTpMQt58ymOfOvZtEfrbWyNYeMBRS41ixdrSZ39of1T2tFa61Vy1bEMciZpsulxCEaNp1BIbFcyVrOZZrCjH4IDKSCku6+n/YFCr73/d5xd9yPVry22933+Tz3eZ739/l+nu/zeR6YZZYZISQA3VfmpjewGpFiYBWQM/ZRchCygEuTH+lCjHpGAq3y1MH+tArQt+5bg9t4AJW1QF4czTeB0Syexm0pFaC1ZSsJBrcAj5AY2oFq8fj3Jl2A+korQbeAzCXxHEJ5Rbz+toQL0LrHMgn0NwP3kFwCIM+Kp+HlhAlQX/FN4DKHOZtUoewRr//BGQvQbWXXMxo8T3rYLh7/o3EL0Lqi+QQyu1N650NRWSfehn3EKkCrCrJwX+kHzCnSypwFMDeOWTMSI0Pwy0UI/mm3Gdwum/2fxSbAV1oLPG4zrHkSlt5GUhgegKNvwA+nQi2d5LlvlfL6YKjB5eRHfSU3AhtshrJXk9d5k+yr4d4XIHcRIayiz/DigKMAlI0wtgSwkreUlHDtCodC9WhNYe60ArSqdBEi9rsfbsi/2AtNz41/J3Ik7NwAWZ7QwgxbtQxK0CjXNVOfV/O77zysfZqkoTwMvBj5EVIpiMrZwPf2YOv+kiSzTKvvvzusAK0rywGNToDLTVoQLbR0w2IMBi3GiMxbCCvuspbll5N8tDBSDOTH5Gu1F+ZMCZf8daSA5bpjwxWycecfdgHKkpjdpabTVkaG5wE/OwSxxC4gHRiGKQAHAZpcAce2Q8eumftx67xwMZCQJN+R0y1w8tD474UrYcktCXEbOgIX4vZ0uhW+NhM2B/q7oMU3ef1xFYz+HndTqA79/TM0BuITcOlHaKmG9necX2aHX7NeXx6GI6/H1dQYRjCMACE+AUfftHbWfEv/c70VhsYmDCsXOuFEQ1zNkZMTRoAhJ2N21vEu9H43eW0mJKaIwCh0+uFcR/j/Ht8DP30Ta4sX5aHdw2FGwNUYk6uz7fDVAXv5YA8c2QqfvxfdzBQLqhanFgHiqTfH+mDUz/0nNeHt0S7s+rug7W2iRuTDyMtp1cOIFE3r6NNaWLCMhDDYA2faYPkd09U8Ix5/a2QBhjThpnLavU4z9Us1wu7QIls+IE/4e1DdSToZHnAqPQuXp7xMIuXEwg5ztraV950jJfQ6tSM+qWgejEqAeBrNuc0+CsffT66I4Ykc2wxsK53kuapj2xeqK7qKQOaxiQOL9G5suVxFsukDy+wT3dZidel1CN86brGkCuElqfA/E948DVpTfDPqSnq2Hob94vGXEAHnIJ6CVOw/MZ6pqS2Akn7nPZE7P14tloO8/mAtSsTt7hkjjGJouXgbm6Kr/m87YjKkUjY3RP3I/v8O+WzHrC5dj1KA4LihGRn5CIzGlB+zhqLP35nB/NxChEIQM9ldDFwTUs3cx+lGOAXajNAsmxp7Z9p20pJ43bU+m19/W4xIDurunliqz/Kf4y/RG3kqXwPy4gAAAABJRU5ErkJggg==',
  item_params: 'data:image/png;base64,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',
};
if (typeof window !== "undefined") { window.PZ_OFFICIAL_ICONS = PZ_OFFICIAL_ICONS; }

let getPzIconPark = typeof getIconPark === 'function' ? getIconPark : null;
if (!getPzIconPark) {
  try {
    getPzIconPark = require('../../../ui/iconpark.js').getIconPark;
  } catch (_) {
    try {
      getPzIconPark = require('../../ui/iconpark.js').getIconPark;
    } catch (__) {
      getPzIconPark = (name, size) => `<span class="icon-${name}"></span>`;
    }
  }
}

class PowerzPanel {
  constructor(container, options = {}) {
    this.container = container;
    this.parentView = options.parentView || null;
    this.companionBaseUrl = options.companionBaseUrl || 'http://127.0.0.1:28123';
    this.captureDir = '';
    this._destroyed = false;
    this._refreshing = false;
    this._listSignature = null;
    this._archiveMessageKey = null;
    this._adcArchiveMessageKey = null;
    this._requestErrorKey = null;

    // 当前视图模式: 'console' | 'curve' | 'pd'
    this.currentMode = 'console';
    this.activeFile = null;
    this.curveData = null;
    this.pdData = null;
    this.selectedPacketIdx = 0;
    this.filterText = '';

    // 数据记录仪 (图2) 专属状态
    this.hudCollapsed = false;
    this.measureEnabled = true; // 测量功能开关 (默认开启，可在左上角曲线内容设置中切换)
    this.showSubChart = false; // "显示副图" (图2: 主副图分屏显示)
    this.useAbsCurrentStats = false; // "使用绝对值统计电流"
    this.showStats = true; // "显示统计" (左下角统计表)
    this.showExtremes = false; // "显示极值" (图3: 左上角动态极值指标)
    this.highSampleRateBoost = false; // "高采样率时提高刷新率"
    this.contentMenuOpen = false; // 曲线内容设置菜单展开/折叠
    this.curveWindow = [0, 1]; // 视窗 [startRatio, endRatio]
    this.hoverPoint = null;
    this.hoveringCursor = null; // 't1' | 't2' | null
    this.t1Ratio = 0.446; // 默认游标 T1 相对时间位置 (~11.57s / 25.96s)
    this.t2Ratio = 0.597; // 默认游标 T2 相对时间位置 (~15.49s / 25.96s)
    this.draggingCursor = null; // 't1' | 't2' | null
    this.draggingCanvas = false; // 是否正在鼠标拖拽平移时间轴
    this.dragStartX = 0;
    this.dragStartWindow = [0, 1];
    this.reverseCurrent = false; // 电流方向指示与正负翻转
    this.settingsOpen = false;

    // 坐标轴缩放模式: 'auto2' (y轴始终包含0) | 'auto1' (紧贴数据范围)
    this.vbusScaleMode = 'auto2';
    this.ibusScaleMode = 'auto2';

    // 通道配置 (完全对应图1中官方颜色体系)
    this.channels = {
      vbus: { enabled: true, color: '#3cb371', name: 'mediumseagreen', alpha: 1.0, width: 1.6, label: 'VBUS' },
      ibus: { enabled: true, color: '#ffb6c1', name: 'lightpink', alpha: 1.0, width: 1.6, label: 'IBUS' },
      dp:   { enabled: true, color: '#7fff00', name: 'chartreuse', alpha: 1.0, width: 1.2, label: 'DP' },
      dm:   { enabled: true, color: '#ffe4b5', name: 'moccasin', alpha: 1.0, width: 1.2, label: 'DM' },
      cc1:  { enabled: true, color: '#ffc0cb', name: 'pink', alpha: 1.0, width: 1.2, label: 'CC1' },
      cc2:  { enabled: true, color: '#20b2aa', name: 'lightseagreen', alpha: 1.0, width: 1.2, label: 'CC2' },
      temp: { enabled: false, color: '#ff69b4', name: 'hotpink', alpha: 1.0, width: 1.2, label: 'TEMP' }
    };

    this.render();
    this.bindEvents();
    this.refreshCaptures();
    this._refreshTimer = setInterval(() => {
      if (!this.container.isConnected) { this.destroy(); return; }
      if (this.currentMode === 'console') {
        this.refreshCaptures({ silent: true });
      }
    }, options.refreshIntervalMs || 1500);
  }

  render() {
    this.container.innerHTML = `
      <style id="pz-console-styles">
        #twChargerPane_powerz {
          background:#0a0c10 !important;
          padding:4px 6px 6px !important;
          border-radius:4px !important;
          color:#e2e8f0;
          font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
          height:100% !important;
          max-height:100% !important;
          min-height:0 !important;
          display:flex !important;
          flex-direction:column !important;
          flex:1 1 0 !important;
          overflow:hidden !important;
          box-sizing:border-box !important;
        }
        .pz-wrap {
          width:100% !important;
          height:100% !important;
          max-height:100% !important;
          min-height:0 !important;
          display:flex !important;
          flex-direction:column !important;
          flex:1 1 0 !important;
          overflow:hidden !important;
          box-sizing:border-box !important;
          user-select:none !important;
        }
        .pz-wrap * { box-sizing:border-box; }

        /* 三大视图共享尺寸规范 (主控制台、数据记录仪、PD协议分析仪) */
        #pzMainView.pz-con,
        #pzCurveView,
        #pzPdView {
          width:100% !important;
          height:100% !important;
          max-height:100% !important;
          min-height:0 !important;
          flex:1 1 0 !important;
          flex-direction:column !important;
          overflow:hidden !important;
          position:relative !important;
          box-sizing:border-box !important;
        }

        /* 视图严格单例互斥：未激活严格隐藏，激活独占 flex 容器 */
        #pzMainView:not(.is-active),
        #pzCurveView:not(.is-active),
        #pzPdView:not(.is-active) {
          display:none !important;
        }
        #pzMainView.is-active,
        #pzCurveView.is-active,
        #pzPdView.is-active {
          display:flex !important;
        }

        /* 主控制台特定外观 */
        #pzMainView.pz-con {
          background:#12151d;
          border:1px solid #232838;
          border-radius:6px;
          padding:12px;
        }
        .pz-con-title { display:flex; align-items:center; justify-content:space-between; font-size:13px; font-weight:800; color:#cbd5e1; margin-bottom:12px; }
        .pz-title-left { display:flex; align-items:center; gap:8px; }
        .pz-con-badge { background:#2563eb; color:#fff; border-radius:3px; padding:2px 6px; font-size:10px; font-weight:900; }
        .pz-con-row { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px; }
        .pz-btn { background:#181c26 !important; border:1px solid #283144 !important; color:#cbd5e1 !important; font-size:12px !important; font-weight:600 !important;
                  border-radius:4px !important; padding:5px 12px !important; cursor:pointer !important; transition:all .15s !important; display:inline-flex !important; align-items:center !important; gap:6px !important; line-height:1.2 !important; }
        .pz-btn:hover { background:#222838 !important; color:#fff !important; border-color:#3b82f6 !important; }
        .pz-btn.primary { background:#2563eb !important; border-color:#2563eb !important; color:#fff !important; }
        .pz-btn.primary:hover { background:#3b82f6 !important; }
        .pz-btn.sm { font-size:11px !important; padding:3px 8px !important; border-radius:3px !important; gap:4px !important; }
        .pz-con-sub { font-size:11px; color:#94a3b8; margin:10px 0 6px; font-weight:700; display:flex; justify-content:space-between; align-items:center; }
        .pz-con-dir { font-family:Consolas,monospace; font-size:10px; color:#64748b; margin-bottom:8px; word-break:break-all; }
        .pz-list { background:#0e1017; border:1px solid #1e2230; border-radius:4px; flex:1 1 0; min-height:160px; max-height:none; overflow-y:auto; padding:6px; }
        .pz-item { font-family:Consolas,monospace; font-size:11px; color:#cbd5e1; padding:6px 8px; border-radius:4px;
                   display:flex; align-items:center; justify-content:space-between; margin-bottom:3px; background:#141722; border:1px solid transparent; transition:all .15s; }
        .pz-item:hover { background:#1d2232; border-color:#3b82f6; color:#fff; }
        .pz-item-info { display:flex; align-items:center; gap:8px; }
        .pz-item-tag { font-size:9px; font-weight:800; border-radius:2px; padding:1px 5px; }
        .pz-tag-db { background:#065f46; color:#6ee7b7; border:1px solid #059669; }
        .pz-tag-pd { background:#075985; color:#7dd3fc; border:1px solid #0284c7; }
        .pz-tag-other { background:#334155; color:#94a3b8; }
        .pz-item-name { font-weight:600; color:#93c5fd; }
        .pz-item-meta { display:flex; align-items:center; gap:10px; }
        .pz-item .sz { color:#64748b; font-size:10px; }
        .pz-empty { color:#64748b; font-size:11px; padding:14px; text-align:center; }
        .pz-sum { display:none; margin-top:10px; background:#0e1e28; border:1px solid #1a3344; border-radius:4px;
                  padding:8px 10px; font-family:Consolas,monospace; font-size:11px; color:#cbd5e1; white-space:pre-wrap; line-height:1.5; }
        .pz-log { margin-top:10px; font-family:Consolas,monospace; font-size:10px; color:#64748b; max-height:60px; overflow-y:auto; }

        /* 顶部导航与通用徽章 (图2 图3 顶部条) */
        .pz-view-header { flex-shrink:0 !important; display:flex !important; align-items:center !important; justify-content:space-between !important; margin-bottom:5px !important; background:#11141c !important; border:1px solid #202636 !important; border-radius:4px !important; padding:4px 8px !important; }
        .pz-header-left { display:flex !important; align-items:center !important; gap:8px !important; }
        .pz-badge-device { background:#161a24 !important; color:#cbd5e1 !important; font-family:Consolas,monospace !important; font-weight:700 !important; font-size:11px !important; padding:2px 7px !important; border-radius:3px !important; border:1px solid #283144 !important; display:flex !important; align-items:center !important; gap:6px !important; }
        .pz-badge-device .num { background:#2563eb !important; color:#fff !important; padding:0 4px !important; border-radius:2px !important; font-size:10px !important; font-weight:800 !important; }
        .pz-tabs-switch { display:flex !important; gap:2px !important; background:#090c12 !important; border:1px solid #1a202c !important; border-radius:4px !important; padding:2px !important; }
        .pz-tab-btn { display:inline-flex !important; align-items:center !important; background:transparent !important; border:1px solid transparent !important; color:#8592a6 !important; font-size:11px !important; font-weight:600 !important; padding:3px 8px !important; border-radius:3px !important; cursor:pointer !important; transition:all .15s !important; gap:5px !important; }
        .pz-tab-btn .tw-ip-icon { flex-shrink:0 !important; }
        .pz-tab-btn .pz-tab-arrow { display:inline-flex !important; align-items:center !important; margin-left:2px !important; opacity:0.8 !important; }
        .pz-tab-btn.active { background:#1a2130 !important; border-color:#2b3952 !important; color:#38bdf8 !important; font-weight:700 !important; box-shadow:0 1px 3px rgba(0,0,0,0.3) !important; }
        .pz-tab-btn:hover:not(.active) { color:#cbd5e1 !important; background:#141822 !important; }

        /* 1:1 复刻官方紧凑 HUD 看板 (Segoe UI / Bahnschrift 比例字体，彻底根治图5粗笨丑化问题) */
        .pz-hud-grid { flex-shrink:0 !important; display:flex !important; flex-wrap:nowrap !important; gap:4px !important; margin-bottom:4px !important; max-width:780px !important; transition:max-height 0.25s ease, opacity 0.2s; overflow:hidden !important; }
        .pz-hud-grid.collapsed { max-height:0 !important; margin-bottom:0 !important; opacity:0 !important; pointer-events:none !important; }
        .pz-hud-card { height:42px !important; min-height:42px !important; max-height:42px !important; padding:3px 8px 3px !important; border-radius:4px !important; position:relative !important; overflow:hidden !important; font-family:"Segoe UI", "Bahnschrift", -apple-system, BlinkMacSystemFont, Arial, sans-serif !important; display:flex !important; flex-direction:column !important; justify-content:flex-start !important; gap:0 !important; box-sizing:border-box !important; }
        .pz-hud-vbus { flex:0 0 205px !important; background:#3dae8c !important; border:1px solid rgba(255,255,255,0.18) !important; color:#ffffff !important; }
        .pz-hud-ibus { flex:0 0 174px !important; background:#dc7989 !important; border:1px solid rgba(255,255,255,0.18) !important; color:#ffffff !important; }
        .pz-hud-pwr  { flex:0 0 174px !important; background:#2b97e4 !important; border:1px solid rgba(255,255,255,0.18) !important; color:#ffffff !important; }
        .pz-hud-sub  { flex:0 0 180px !important; background:#2b2d35 !important; border:1px solid rgba(255,255,255,0.12) !important; color:#e2e8f0 !important; }
        .pz-hud-title { font-size:9.5px !important; font-weight:700 !important; opacity:0.95 !important; height:12px !important; min-height:12px !important; max-height:12px !important; line-height:12px !important; margin:0 !important; padding:0 !important; display:flex !important; align-items:center !important; letter-spacing:0.4px !important; box-sizing:border-box !important; }
        .pz-hud-dir-btn { position:absolute !important; top:3px !important; right:8px !important; background:#ffffff !important; color:#dc7989 !important; width:13px !important; height:13px !important; border-radius:50% !important; display:inline-flex !important; align-items:center !important; justify-content:center !important; font-size:8.5px !important; font-weight:900 !important; cursor:pointer !important; line-height:1 !important; z-index:2 !important; user-select:none !important; }
        .pz-hud-val { height:24px !important; min-height:24px !important; max-height:24px !important; line-height:24px !important; margin:0 !important; padding:0 !important; font-size:22px !important; font-weight:700 !important; letter-spacing:0.2px !important; white-space:nowrap !important; font-variant-numeric:tabular-nums !important; -webkit-font-smoothing:antialiased !important; box-sizing:border-box !important; }

        .pz-hud-sub-grid { display:grid !important; grid-template-columns:1fr 1fr !important; gap:1px 6px !important; font-size:9.5px !important; line-height:1.25 !important; margin-top:0 !important; }
        .pz-hud-sub-item { display:flex !important; justify-content:space-between !important; gap:3px !important; }
        .pz-hud-sub-item .k { color:#94a3b8 !important; font-weight:600 !important; font-size:9px !important; }
        .pz-hud-sub-item .v { font-weight:700 !important; color:#ffffff !important; font-size:9.5px !important; font-variant-numeric:tabular-nums !important; }

        /* 图2: 曲线副工具栏 (带左上角曲线内容设置图标) */
        .pz-sub-bar { flex-shrink:0 !important; position:relative !important; display:flex !important; align-items:center !important; justify-content:space-between !important; background:#11141c !important; border:1px solid #202636 !important; border-radius:4px !important; padding:2px 8px !important; margin-bottom:4px !important; font-size:11px !important; font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif !important; }
        .pz-sub-left { display:flex !important; align-items:center !important; gap:6px !important; }
        .pz-menu-icon-btn { background:#181c26 !important; border:1px solid #283144 !important; color:#94a3b8 !important; width:22px !important; height:22px !important; border-radius:3px !important; display:inline-flex !important; align-items:center !important; justify-content:center !important; cursor:pointer !important; transition:all .15s !important; padding:0 !important; }
        .pz-menu-icon-btn:hover, .pz-menu-icon-btn.active { background:#2563eb !important; border-color:#3b82f6 !important; color:#ffffff !important; }
        .pz-collapse-btn { background:#181c26 !important; border:1px solid #283144 !important; color:#94a3b8 !important; width:22px !important; height:22px !important; border-radius:3px !important; display:inline-flex !important; align-items:center !important; justify-content:center !important; cursor:pointer !important; padding:0 !important; transition:transform 0.2s, background 0.15s, color 0.15s !important; }
        .pz-collapse-btn:hover { background:#2563eb !important; border-color:#3b82f6 !important; color:#ffffff !important; }
        .pz-collapse-btn.collapsed { transform:rotate(180deg) !important; }
        .pz-ch-tag { background:#141722 !important; border:1px solid #232a3b !important; color:#8592a6 !important; font-size:10px !important; font-weight:700 !important; border-radius:3px !important; padding:2px 7px !important; cursor:pointer !important; user-select:none !important; transition:all .15s !important; }
        .pz-ch-tag:hover:not(.active) { background:#1c2230 !important; color:#cbd5e1 !important; border-color:#323d54 !important; }
        .pz-ch-tag.active { background:#1e3a8a !important; color:#93c5fd !important; border-color:#3b82f6 !important; }
        .pz-sub-center-title { font-weight:700 !important; font-size:12.5px !important; color:#e2e8f0 !important; letter-spacing:0.3px !important; }
        .pz-sub-right { display:flex !important; align-items:center !important; gap:6px !important; }
        .pz-action-tag { background:#141722 !important; border:1px solid #232a3b !important; color:#8592a6 !important; font-size:10px !important; font-weight:700 !important; border-radius:3px !important; padding:2px 6px !important; cursor:pointer !important; display:inline-flex !important; align-items:center !important; gap:3px !important; transition:all .15s !important; }
        .pz-action-tag:hover { color:#ffffff !important; border-color:#3b82f6 !important; background:#1c2230 !important; }

        /* 左上角曲线内容设置展开浮窗菜单 (10 项功能) */
        .pz-content-menu { position:absolute !important; left:6px !important; top:30px !important; z-index:100 !important; background:rgba(18, 22, 32, 0.95) !important; border:1px solid #2d3748 !important; border-radius:5px !important; box-shadow:0 12px 28px rgba(0, 0, 0, 0.65) !important; backdrop-filter:blur(12px) !important; -webkit-backdrop-filter:blur(12px) !important; width:195px !important; padding:4px 0 !important; font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif !important; font-size:11px !important; user-select:none !important; }
        .pz-menu-item { display:flex !important; align-items:center !important; gap:8px !important; padding:5px 10px !important; color:#94a3b8 !important; cursor:pointer !important; transition:all 0.12s !important; }
        .pz-menu-item:hover { background:#2563eb !important; color:#ffffff !important; }
        .pz-menu-item .tw-ip-icon { flex-shrink:0 !important; opacity:0.9 !important; }
        .pz-menu-item:hover .tw-ip-icon { opacity:1 !important; stroke:#ffffff !important; }
        .pz-menu-divider { height:1px !important; background:#242c3d !important; margin:3px 0 !important; }
        .pz-menu-check { width:13px !important; height:13px !important; border:1px solid #3c485e !important; border-radius:2px !important; display:inline-flex !important; align-items:center !important; justify-content:center !important; font-size:9px !important; color:#ffffff !important; background:#0d1017 !important; flex-shrink:0 !important; }
        .pz-menu-check-placeholder { width:13px !important; height:13px !important; flex-shrink:0 !important; display:inline-block !important; }
        .pz-menu-item.checked .pz-menu-check { background:#2563eb !important; border-color:#3b82f6 !important; color:#ffffff !important; }

        /* 图2: 主画布容器 (1:1 坐标系、双游标、右上T1-T2差值表、左下统计表、POWER-Z水印) */
        .pz-chart-wrap {
          position:relative !important;
          background:#05070a !important;
          border:1px solid #1c202a !important;
          border-radius:4px !important;
          flex:1 1 0 !important;
          min-height:100px !important;
          margin-bottom:4px !important;
          overflow:hidden !important;
          box-sizing:border-box !important;
        }
        .pz-canvas { width:100%; height:100%; display:block; cursor:crosshair; }

        /* 右上角 T1-T2 差值计算框 (官方毛玻璃虚化透光风格) */
        .pz-diff-overlay { position:absolute; right:55px; top:12px; background:rgba(18, 24, 38, 0.55); border:1px solid rgba(255, 255, 255, 0.16); border-radius:6px; padding:6px 12px; font-family:"Segoe UI", -apple-system, BlinkMacSystemFont, Arial, sans-serif; font-size:10.5px; color:#e2e8f0; pointer-events:none; line-height:1.4; min-width:155px; box-shadow:0 8px 24px rgba(0, 0, 0, 0.45); backdrop-filter:blur(12px) saturate(180%); -webkit-backdrop-filter:blur(12px) saturate(180%); }
        .pz-diff-header { color:#f1f5f9; font-weight:800; border-bottom:1px solid rgba(255, 255, 255, 0.16); padding-bottom:2px; margin-bottom:4px; font-size:11px; }
        .pz-diff-row { display:flex; justify-content:space-between; gap:12px; }
        .pz-diff-row .k { color:#94a3b8; }
        .pz-diff-row .v { color:#f1f5f9; font-weight:700; text-align:right; font-variant-numeric:tabular-nums; }

        /* 左下角 全部/窗口 统计覆盖表 (完全通透风格，消除死黑遮挡) */
        .pz-stats-overlay { position:absolute; left:60px; bottom:28px; background:transparent !important; border:1px solid rgba(255, 255, 255, 0.14); border-radius:4px; padding:4px 8px; font-family:"Segoe UI", Consolas, monospace; font-size:10px; color:#e2e8f0; pointer-events:none; line-height:1.35; box-shadow:none; backdrop-filter:none; }
        .pz-stats-table { border-collapse:collapse; text-align:right; }
        .pz-stats-table th { color:#94a3b8; font-weight:600; padding:0 6px 3px; border-bottom:1px solid rgba(255, 255, 255, 0.12); font-size:9.5px; }
        .pz-stats-table td { padding:2px 6px; font-size:10px; font-variant-numeric:tabular-nums; color:#e2e8f0; }
        .pz-stats-badge { color:#fff; padding:1px 5px; border-radius:2px; font-weight:800; font-size:9.5px; opacity:0.9; }

        /* 右下角 POWER-Z 官方水印 */
        .pz-watermark { position:absolute; right:62px; bottom:30px; font-family:"Impact", "Arial Black", sans-serif; font-size:15px; letter-spacing:2px; color:#232836; pointer-events:none; }

        /* 图2: 底部缩略图时间轴与滑块 */
        .pz-overview-wrap {
          position:relative !important;
          background:#0f1118 !important;
          border:1px solid #1e2230 !important;
          border-radius:4px !important;
          height:34px !important;
          min-height:34px !important;
          max-height:34px !important;
          flex-shrink:0 !important;
          overflow:hidden !important;
          margin-bottom:2px !important;
          box-sizing:border-box !important;
        }
        .pz-overview-canvas { width:100%; height:100%; display:block; cursor:pointer; }
        .pz-slider-window { position:absolute; top:0; bottom:0; background:rgba(37, 99, 235, 0.20); border:1px solid #3b82f6; cursor:grab; }

        /* 图1: 坐标轴与颜色设置弹窗 (浮动模态框) */
        .pz-modal-mask { position:absolute; inset:0; background:rgba(0,0,0,0.45); z-index:10; display:flex; align-items:center; justify-content:center; }
        .pz-settings-modal { background:#1e222e; border:1px solid #363e52; border-radius:6px; width:340px; padding:12px; font-family:Consolas,monospace; font-size:11px; box-shadow:0 12px 28px rgba(0,0,0,0.7); }
        .pz-modal-header { display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #2f3647; padding-bottom:6px; margin-bottom:8px; font-weight:800; color:#cbd5e1; }
        .pz-modal-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; font-size:11px; }
        .pz-modal-row select { background:#12151d; border:1px solid #2d3448; color:#cbd5e1; border-radius:3px; padding:2px 4px; font-size:10px; }
        .pz-color-table { width:100%; border-collapse:collapse; margin-top:6px; }
        .pz-color-table th { color:#94a3b8; font-size:10px; text-align:left; padding:3px 2px; border-bottom:1px solid #2d3448; }
        .pz-color-table td { padding:4px 2px; font-size:10px; }
        .pz-color-swatch { width:14px; height:14px; border-radius:2px; display:inline-block; vertical-align:middle; margin-right:4px; }
        .pz-slider-input { width:65px; height:4px; vertical-align:middle; }

        /* 图3: PD 协议分析仪布局 (上下分栏) */
        .pz-pd-table-wrap { background:#0e1017; border:1px solid #1e2230; border-radius:4px; flex:1 1 0 !important; min-height:80px !important; overflow-y:auto; margin-bottom:2px; }
        .pz-pd-table { width:100%; border-collapse:collapse; font-family:Consolas,monospace; font-size:11px; text-align:left; }
        .pz-pd-table thead { position:sticky; top:0; background:#181b24; z-index:2; border-bottom:1px solid #2d3448; }
        .pz-pd-table th { padding:5px 8px; color:#94a3b8; font-weight:700; white-space:nowrap; }
        .pz-pd-table td { padding:3.5px 8px; border-bottom:1px solid #161924; white-space:nowrap; }
        .pz-pd-row { cursor:pointer; }
        .pz-pd-row:hover { background:#181e2b; }
        .pz-pd-row.selected { background:#0f2b48 !important; color:#fff !important; }
        .pz-pd-row.selected td:not(.pz-pd-msg-cell) { background:#0f2b48 !important; }
        @keyframes pzRowFlash {
          0% { box-shadow: inset 0 0 0 2px #38bdf8; }
          100% { box-shadow: inset 0 0 0 2px transparent; }
        }
        .pz-pd-row.pz-flash {
          animation: pzRowFlash 1.2s ease-out;
        }

        /* Msg 列背景完全覆盖整个单元格 (复刻官方 KM003C 规范) */
        .pz-pd-table td.pz-pd-msg-cell {
          padding: 3px 6px !important;
          text-align: center !important;
          font-weight: 700 !important;
          font-size: 10.5px !important;
          color: #ffffff !important;
          border-bottom: 1px solid #161924 !important;
          border-left: 1px solid rgba(255,255,255,0.08) !important;
          border-right: 1px solid rgba(255,255,255,0.08) !important;
          line-height: 1.25 !important;
        }
        .pz-pd-table td.pz-pd-msg-cell.pz-badge-goodcrc { background:#0284c7 !important; }
        .pz-pd-table td.pz-pd-msg-cell.pz-badge-accept  { background:#0d9488 !important; }
        .pz-pd-table td.pz-pd-msg-cell.pz-badge-ps_rdy  { background:#c2410c !important; }
        .pz-pd-table td.pz-pd-msg-cell.pz-badge-request { background:#e11d48 !important; }
        .pz-pd-table td.pz-pd-msg-cell.pz-badge-source_caps { background:#7c3aed !important; }
        .pz-pd-table td.pz-pd-msg-cell.pz-badge-sink_caps   { background:#059669 !important; }
        .pz-pd-table td.pz-pd-msg-cell.pz-badge-other       { background:#475569 !important; }

        /* 官方点状调节器 (上下分栏: 6个水平点) */
        .pz-pd-h-splitter {
          flex-shrink: 0 !important;
          height: 12px !important;
          background: #10131b !important;
          border-top: 1px solid #1c212f !important;
          border-bottom: 1px solid #1c212f !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          cursor: row-resize !important;
          user-select: none !important;
          margin: 0 !important;
          touch-action: none !important;
          transition: background .15s, border-color .15s !important;
        }
        .pz-pd-h-splitter:hover, .pz-pd-h-splitter.is-dragging {
          background: #171d2b !important;
          border-color: #2b3548 !important;
        }
        .pz-pd-dots-h {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 3.5px !important;
          height: 100% !important;
          padding: 0 32px !important;
          cursor: row-resize !important;
          pointer-events: none !important;
        }
        .pz-pd-dots-h span {
          width: 3px !important;
          height: 3px !important;
          border-radius: 50% !important;
          background: #505a72 !important;
          pointer-events: none !important;
          transition: background .15s !important;
        }
        .pz-pd-h-splitter:hover .pz-pd-dots-h span,
        .pz-pd-h-splitter.is-dragging .pz-pd-dots-h span {
          background: #38bdf8 !important;
        }

        /* 下部分割容器 (Flex 水平布局 - 允许动态拖拽高度) */
        .pz-pd-lower-split {
          display: flex !important;
          flex-direction: row !important;
          gap: 0 !important;
          height: 190px;
          min-height: 60px;
          max-height: 700px;
          flex-shrink: 0 !important;
          margin-bottom: 2px !important;
          overflow: hidden !important;
        }
        .pz-pd-detail-pane {
          flex: 0 0 50%;
          min-width: 160px;
          max-width: calc(100% - 160px);
          background: #12151d;
          border: 1px solid #1e2230;
          border-radius: 4px;
          padding: 8px 10px;
          overflow-y: auto;
          font-family: Consolas, monospace;
          font-size: 11px;
          box-sizing: border-box;
        }
        .pz-pd-detail-title { font-size:11px; font-weight:800; color:#93c5fd; margin-bottom:5px; display:flex; justify-content:space-between; }
        .pz-pd-detail-meta { display:flex; gap:8px; margin-bottom:6px; font-size:10px; color:#94a3b8; background:#0e1017; padding:4px 6px; border-radius:3px; }
        .pz-pd-detail-meta b { color:#38bdf8; }
        .pz-field-table { width:100%; border-collapse:collapse; margin-bottom:6px; font-size:9.5px; }
        .pz-field-table th { background:#1a1e2b; color:#94a3b8; padding:3px; border:1px solid #2d3448; font-weight:600; text-align:center; }
        .pz-field-table td { padding:3px; border:1px solid #2d3448; text-align:center; color:#e2e8f0; font-weight:700; }
        .pz-rdo-box { background:#0a0c10; border:1px solid #1e2230; border-radius:3px; padding:5px 7px; font-size:10px; line-height:1.4; color:#cbd5e1; }
        .pz-rdo-box b { color:#f43f5e; }

        /* 官方点状调节器 (左右分栏: 6个垂直点) */
        .pz-pd-v-splitter {
          flex-shrink: 0 !important;
          width: 12px !important;
          background: #10131b !important;
          border-left: 1px solid #1c212f !important;
          border-right: 1px solid #1c212f !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: center !important;
          cursor: col-resize !important;
          user-select: none !important;
          margin: 0 !important;
          touch-action: none !important;
          transition: background .15s, border-color .15s !important;
        }
        .pz-pd-v-splitter:hover, .pz-pd-v-splitter.is-dragging {
          background: #171d2b !important;
          border-color: #2b3548 !important;
        }
        .pz-pd-dots-v {
          display: inline-flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 3.5px !important;
          width: 100% !important;
          padding: 32px 0 !important;
          cursor: col-resize !important;
          pointer-events: none !important;
        }
        .pz-pd-dots-v span {
          width: 3px !important;
          height: 3px !important;
          border-radius: 50% !important;
          background: #505a72 !important;
          pointer-events: none !important;
          transition: background .15s !important;
        }
        .pz-pd-v-splitter:hover .pz-pd-dots-v span,
        .pz-pd-v-splitter.is-dragging .pz-pd-dots-v span {
          background: #38bdf8 !important;
        }

        /* 图3: 右下同步波形 */
        .pz-pd-chart-pane {
          flex: 1 1 0 !important;
          min-width: 180px !important;
          position: relative;
          background: #0d0f14;
          border: 1px solid #1e2230;
          border-radius: 4px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
        }
        .pz-pd-chart-bar { display:flex; align-items:center; justify-content:space-between; padding:3px 8px; background:#12151d; border-bottom:1px solid #1e2230; font-size:10px; font-family:Consolas,monospace; }
        .pz-pd-chart-legends { display:flex; gap:8px; }
        .pz-pd-chart-canvas { flex:1; width:100%; height:100%; display:block; cursor:crosshair; }
      </style>

      <div class="pz-wrap">
        <!-- 1. 主控制台视图 -->
        <div id="pzMainView" class="pz-con is-active">
          <div class="pz-con-title">
            <div class="pz-title-left">
              <span class="pz-con-badge">Z</span> POWER-Z 官方控制台
            </div>
            <div id="pzArchiveState" style="color:#94a3b8;font-size:11px;font-weight:400;">监测中</div>
          </div>

          <div class="pz-con-row">
            <button class="pz-btn primary" id="pzLaunchMtools" title="PD 保存、曲线停止后自动日期存档">${getPzIconPark('send', 12)} <span>启动采集 (Mtools)</span></button>
            <button class="pz-btn" id="pzLaunchPdm">${getPzIconPark('lightning', 12)} <span>协议工具 (PDM)</span></button>
            <button class="pz-btn" id="pzOpenDir">${getPzIconPark('folder', 12)} <span>打开目录</span></button>
            <button class="pz-btn" id="pzRefresh">${getPzIconPark('refresh', 12)} <span>刷新</span></button>
          </div>

          <div class="pz-con-sub">采集目录</div>
          <div class="pz-con-dir" id="pzDir">加载中...</div>

          <div class="pz-con-sub">
            <span>采集文件与协议报文</span>
            <span style="font-size:10px;color:#64748b;font-weight:400;">点击任意文件即刻图表可视化解析</span>
          </div>
          <div class="pz-list" id="pzList"><div class="pz-empty">加载中...</div></div>

          <div class="pz-sum" id="pzSummary"></div>
          <div class="pz-log" id="pzLog"></div>
        </div>

        <!-- 2. 数据记录仪视图 (1:1 复刻 图2) -->
        <div id="pzCurveView" class="pz-curve-view">
          <div class="pz-view-header">
            <div class="pz-header-left">
              <button class="pz-btn sm" id="pzBackFromCurve">${getPzIconPark('left', 11)} <span>采集列表</span></button>
              <div class="pz-badge-device">
                <span class="num">34</span> KM003C <span id="pzCurveFileLabel">033618</span>
              </div>
              <div class="pz-tabs-switch">
                <button class="pz-tab-btn active">${getPzIconPark('chart-line', 13)} <span>数据记录仪</span></button>
                <button class="pz-tab-btn" id="pzSwitchToPd">${getPzIconPark('lightning', 13)} <span>PD协议分析仪</span> <span class="pz-tab-arrow">${getPzIconPark('down', 9)}</span></button>
              </div>
            </div>
            <div>
              <button class="pz-btn sm" id="pzReloadCurve">${getPzIconPark('refresh', 11)} <span>重新载入</span></button>
            </div>
          </div>

          <!-- 1:1 复刻 4列 HUD 看板 (可折叠) -->
          <div class="pz-hud-grid" id="pzHudGrid">
            <div class="pz-hud-card pz-hud-vbus">
              <div class="pz-hud-title">VBUS</div>
              <div class="pz-hud-val" id="pzHudVbus">0.000 000 V</div>
            </div>
            <div class="pz-hud-card pz-hud-ibus">
              <div class="pz-hud-title">IBUS</div>
              <span class="pz-hud-dir-btn" id="pzHudDirBtn" title="电流方向指示">⬅</span>
              <div class="pz-hud-val" id="pzHudIbus">0.000 000 A</div>
            </div>
            <div class="pz-hud-card pz-hud-pwr">
              <div class="pz-hud-title">PWR</div>
              <div class="pz-hud-val" id="pzHudPwr">0.000 00W</div>
            </div>
            <div class="pz-hud-card pz-hud-sub">
              <div class="pz-hud-title">SUB</div>
              <div class="pz-hud-sub-grid">
                <div class="pz-hud-sub-item"><span class="k">DP:</span><span class="v" id="pzHudDp">0.000V</span></div>
                <div class="pz-hud-sub-item"><span class="k">CC1:</span><span class="v" id="pzHudCc1">0.000V</span></div>
                <div class="pz-hud-sub-item"><span class="k">DM:</span><span class="v" id="pzHudDm">0.000V</span></div>
                <div class="pz-hud-sub-item"><span class="k">CC2:</span><span class="v" id="pzHudCc2">0.000V</span></div>
              </div>
            </div>
          </div>

          <!-- 副工具栏与通道选择 (集成曲线内容设置图标) -->
          <div class="pz-sub-bar">
            <div class="pz-sub-left">
              <button class="pz-menu-icon-btn" id="pzContentMenuBtn" title="曲线内容设置">
                ${getPzIconPark('sliders', 13)}
              </button>
              <button class="pz-collapse-btn" id="pzHudToggleBtn" title="展开/收起 HUD 看板">
                ${getPzIconPark('up', 11)}
              </button>
              <span class="pz-ch-tag active" id="pzToggleDpDm">DP/DM</span>
              <span class="pz-ch-tag active" id="pzToggleCc">CC1/CC2</span>
              <span class="pz-ch-tag" id="pzToggleTemp">TEMP</span>
            </div>
            <div class="pz-sub-center-title" id="pzChartParamTitle">Simple Real-Time Chart</div>
            <div class="pz-sub-right">
              <span class="pz-action-tag">CHARGE</span>
              <span class="pz-action-tag">ENERGY</span>
              <span class="pz-action-tag">POWER</span>
              <span class="pz-action-tag"><span>分段标签</span> <span class="pz-tab-arrow">${getPzIconPark('down', 9)}</span></span>
              <span class="pz-action-tag" id="pzSettingsBtn" title="设置坐标轴与颜色">${getPzIconPark('setting-config', 11)} <span>坐标轴范围</span></span>
            </div>

            <!-- 左上角曲线内容设置浮窗菜单 (10 项功能) -->
            <div class="pz-content-menu" id="pzContentMenu" style="display:none;">
              <div class="pz-menu-item" id="pzMenuItemSubChart">
                <span class="pz-menu-check" id="pzCheckSubChart"></span>
                ${getPzIconPark('dashboard', 13)}
                <span>显示副图</span>
              </div>
              <div class="pz-menu-item" id="pzMenuItemAbsCurrent">
                <span class="pz-menu-check" id="pzCheckAbsCurrent"></span>
                ${getPzIconPark('sliders', 13)}
                <span>使用绝对值统计电流</span>
              </div>
              <div class="pz-menu-item checked" id="pzMenuItemStats">
                <span class="pz-menu-check" id="pzCheckStats">✓</span>
                ${getPzIconPark('chart-line', 13)}
                <span>显示统计</span>
              </div>
              <div class="pz-menu-item" id="pzMenuItemExtremes">
                <span class="pz-menu-check" id="pzCheckExtremes"></span>
                ${getPzIconPark('target', 13)}
                <span>显示极值</span>
              </div>
              <div class="pz-menu-item" id="pzMenuItemRateBoost">
                <span class="pz-menu-check" id="pzCheckRateBoost"></span>
                ${getPzIconPark('lightning', 13)}
                <span>高采样率时提高刷新率</span>
              </div>
              <div class="pz-menu-item checked" id="pzMenuItemMeasure">
                <span class="pz-menu-check" id="pzCheckMeasure">✓</span>
                ${getPzIconPark('compass', 13)}
                <span>测量</span>
              </div>
              <div class="pz-menu-divider"></div>
              <div class="pz-menu-item" id="pzMenuItemImport">
                <span class="pz-menu-check-placeholder"></span>
                ${getPzIconPark('folder-download', 13)}
                <span>导入</span>
              </div>
              <div class="pz-menu-item" id="pzMenuItemExport">
                <span class="pz-menu-check-placeholder"></span>
                ${getPzIconPark('upload', 13)}
                <span>导出</span>
              </div>
              <div class="pz-menu-item" id="pzMenuItemSavePic">
                <span class="pz-menu-check-placeholder"></span>
                ${getPzIconPark('pic', 13)}
                <span>保存图片</span>
              </div>
              <div class="pz-menu-item" id="pzMenuItemParams">
                <span class="pz-menu-check-placeholder"></span>
                ${getPzIconPark('setting-config', 13)}
                <span>参数设置</span>
              </div>
            </div>
          </div>

          <!-- 1:1 主画布容器 (双Y轴、T1/T2游标、右上差值、左下统计、POWER-Z水印) -->
          <div class="pz-chart-wrap" id="pzChartWrap">
            <canvas class="pz-canvas" id="pzMainCanvas"></canvas>

            <!-- 右上角 T1-T2 差值计算看板 (图2) -->
            <div class="pz-diff-overlay" id="pzDiffOverlay">
              <div class="pz-diff-header">T1-T2</div>
              <div class="pz-diff-row"><span class="k">Time:</span><span class="v" id="pzDiffTime">00:00:00.000</span></div>
              <div class="pz-diff-row"><span class="k">CC2:</span><span class="v" id="pzDiffCc2">0.000</span></div>
              <div class="pz-diff-row"><span class="k">CC1:</span><span class="v" id="pzDiffCc1">0.000</span></div>
              <div class="pz-diff-row"><span class="k">DM:</span><span class="v" id="pzDiffDm">0.000</span></div>
              <div class="pz-diff-row"><span class="k">DP:</span><span class="v" id="pzDiffDp">0.000</span></div>
              <div class="pz-diff-row"><span class="k">IBUS:</span><span class="v" id="pzDiffIbus">0.000000</span></div>
              <div class="pz-diff-row"><span class="k">VBUS:</span><span class="v" id="pzDiffVbus">0.000000</span></div>
            </div>

            <!-- 左下角 全部/窗口 统计覆盖表 (图2) -->
            <div class="pz-stats-overlay" id="pzStatsOverlay">
              <table class="pz-stats-table">
                <thead>
                  <tr>
                    <th style="text-align:left;">统计</th>
                    <th>累计时间</th>
                    <th>容量 Ah</th>
                    <th>能量 Wh</th>
                    <th>计数 Points</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="text-align:left;"><span class="pz-stats-badge" style="background:#059669;">全部</span></td>
                    <td id="pzStatAllTime">0:0:0</td>
                    <td id="pzStatAllAh">0.0000</td>
                    <td id="pzStatAllWh">0.0000</td>
                    <td id="pzStatAllPts">0</td>
                  </tr>
                  <tr>
                    <td style="text-align:left;"><span class="pz-stats-badge" style="background:#0891b2;">窗口</span></td>
                    <td id="pzStatWinTime">0:0:0</td>
                    <td id="pzStatWinAh">0.0000</td>
                    <td id="pzStatWinWh">0.0000</td>
                    <td id="pzStatWinPts">0</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- 右下角 POWER-Z 官方水印 -->
            <div class="pz-watermark">POWER-Z</div>
          </div>

          <!-- 底部时间轴缩略图 -->
          <div class="pz-overview-wrap" id="pzOverviewWrap">
            <canvas class="pz-overview-canvas" id="pzOverviewCanvas"></canvas>
            <div class="pz-slider-window" id="pzSliderWindow"></div>
          </div>

          <!-- 图1: 坐标轴范围与颜色设置弹窗 (模态框) -->
          <div class="pz-modal-mask" id="pzSettingsModal" style="display:none;">
            <div class="pz-settings-modal">
              <div class="pz-modal-header">
                <span>坐标轴范围</span>
                <span style="cursor:pointer;" id="pzCloseSettings">✕</span>
              </div>
              <div class="pz-modal-row">
                <span>VBUS</span>
                <select id="pzSelVbusScale">
                  <option value="auto2" selected>自动2(y轴始终包含0)</option>
                  <option value="auto1">自动1(紧贴数据范围)</option>
                </select>
              </div>
              <div class="pz-modal-row">
                <span>IBUS</span>
                <select id="pzSelIbusScale">
                  <option value="auto2" selected>自动2(y轴始终包含0)</option>
                  <option value="auto1">自动1(紧贴数据范围)</option>
                </select>
              </div>

              <table class="pz-color-table">
                <thead>
                  <tr>
                    <th style="width:55px;">通道</th>
                    <th style="width:110px;">颜色</th>
                    <th>透明度</th>
                    <th>线宽</th>
                  </tr>
                </thead>
                <tbody id="pzColorTableBody">
                  <!-- 动态插入通道设置 -->
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- 3. PD协议分析仪视图 (对应图3) -->
        <div id="pzPdView" class="pz-pd-view">
          <div class="pz-view-header">
            <div class="pz-header-left">
              <button class="pz-btn sm" id="pzBackFromPd">${getPzIconPark('left', 11)} <span>采集列表</span></button>
              <div class="pz-badge-device">
                <span class="num">34</span> KM003C <span id="pzPdFileLabel">pd.sqlite</span>
              </div>
              <div class="pz-tabs-switch">
                <button class="pz-tab-btn" id="pzSwitchToCurve">${getPzIconPark('chart-line', 13)} <span>数据记录仪</span></button>
                <button class="pz-tab-btn active">${getPzIconPark('lightning', 13)} <span>PD协议分析仪</span> <span class="pz-tab-arrow">${getPzIconPark('down', 9)}</span></button>
              </div>
              <span id="pzPdCountBadge" style="font-family:Consolas,monospace;font-size:11px;color:#94a3b8;font-weight:700;">60/60</span>
            </div>
            <div>
              <input type="text" id="pzPdFilter" placeholder="过滤报文 (如 Request, Accept...)" style="background:#0e1017;border:1px solid #232838;border-radius:4px;padding:3px 8px;font-size:11px;color:#e2e8f0;width:180px;" />
            </div>
          </div>

          <!-- 10列报文表格 (图3 上半部分) -->
          <div class="pz-pd-table-wrap" id="pzPdTableWrap">
            <table class="pz-pd-table">
              <thead>
                <tr>
                  <th style="width:30px;">#</th>
                  <th style="width:40px;">SOP</th>
                  <th style="width:85px;text-align:center;">Msg</th>
                  <th style="width:35px;">ID</th>
                  <th style="width:75px;">Direction</th>
                  <th style="width:35px;">Obj</th>
                  <th style="width:35px;">Rev</th>
                  <th style="width:85px;">Elapsed</th>
                  <th style="width:110px;">VBUS/IBUS</th>
                  <th style="width:120px;">Data</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody id="pzPdTableBody">
                <tr><td colspan="11" class="pz-empty">正在解析协议报文...</td></tr>
              </tbody>
            </table>
          </div>

          <!-- 官方点状水平分栏调节器 (多个点图标，按住拖拽自由调节上下大小) -->
          <div class="pz-pd-h-splitter" id="pzPdHSplitter" title="按住拖拽自由调节上下大小">
            <div class="pz-pd-dots-h" aria-hidden="true">
              <span></span><span></span><span></span><span></span><span></span><span></span>
            </div>
          </div>

          <!-- 下半部分割: 左详细解码，中点状垂直分栏调节器，右同步波形 -->
          <div class="pz-pd-lower-split" id="pzPdLowerSplit">
            <!-- 左侧详细数据解码 -->
            <div class="pz-pd-detail-pane" id="pzPdDetailPane">
              <div class="pz-pd-detail-title">
                <span>详细数据</span>
                <span id="pzDetailIdx" style="color:#64748b;font-size:10px;">Packet #--</span>
              </div>
              <div class="pz-pd-detail-meta" id="pzDetailMeta">
                <span>SOP* <b id="pzDetSop">SOP</b></span>
                <span>Msg Header <b id="pzDetHeader">0x0000</b></span>
                <span>CRC <b id="pzDetCrc">0x00000000</b></span>
              </div>
              <table class="pz-field-table">
                <thead>
                  <tr>
                    <th>Msg Header</th>
                    <th>Extended</th>
                    <th>Objects</th>
                    <th>Msg ID</th>
                    <th>Power Role</th>
                    <th>Spec Rev</th>
                    <th>Data Role</th>
                    <th>Msg Type</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td id="pzDetName" style="color:#38bdf8;">--</td>
                    <td id="pzDetExt">0</td>
                    <td id="pzDetObj">0</td>
                    <td id="pzDetId">0</td>
                    <td id="pzDetPwr">0</td>
                    <td id="pzDetRev">0</td>
                    <td id="pzDetData">0</td>
                    <td id="pzDetType">0</td>
                  </tr>
                </tbody>
              </table>
              <div class="pz-rdo-box" id="pzRdoBox">
                暂无选中报文或报文未携带额外数据对象
              </div>
            </div>

            <!-- 官方点状垂直分栏调节器 (多个点图标，按住拖拽自由调节左右大小) -->
            <div class="pz-pd-v-splitter" id="pzPdVSplitter" title="按住拖拽自由调节左右大小">
              <div class="pz-pd-dots-v" aria-hidden="true">
                <span></span><span></span><span></span><span></span><span></span><span></span>
              </div>
            </div>

            <!-- 右侧电气同步波形图 -->
            <div class="pz-pd-chart-pane" id="pzPdChartPane">
              <div class="pz-pd-chart-bar">
                <div class="pz-pd-chart-legends">
                  <span style="color:#10b981;">■ VBUS: <span id="pzPdWfVbus">--</span></span>
                  <span style="color:#f97316;">■ IBUS: <span id="pzPdWfIbus">--</span></span>
                  <span style="color:#3b82f6;">■ CC1: <span id="pzPdWfCc1">--</span></span>
                  <span style="color:#06b6d4;">■ CC2: <span id="pzPdWfCc2">--</span></span>
                </div>
                <div style="color:#64748b;" id="pzPdWfCount">314</div>
              </div>
              <canvas class="pz-pd-chart-canvas" id="pzPdWaveformCanvas" title="点击波形任意位置即可定位到对应报文附近"></canvas>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  bindEvents() {
    // 监听视口与容器尺寸变化，动态撑满重绘 Canvas
    if (typeof ResizeObserver !== 'undefined') {
      this._resizeObserver = new ResizeObserver(() => {
        if (this._destroyed) return;
        if (this.currentMode === 'curve') {
          this.drawMainChart();
          this.drawOverviewChart();
        } else if (this.currentMode === 'pd') {
          this.drawPdWaveform();
        }
      });
      const chartWrap = this.container.querySelector('#pzChartWrap');
      if (chartWrap) this._resizeObserver.observe(chartWrap);
      this._resizeObserver.observe(this.container);
    }

    this._windowResizeHandler = () => {
      if (this._destroyed) return;
      if (this.currentMode === 'curve') {
        this.drawMainChart();
        this.drawOverviewChart();
      } else if (this.currentMode === 'pd') {
        this.drawPdWaveform();
      }
    };
    window.addEventListener('resize', this._windowResizeHandler);

    const on = (id, fn) => { const el = this.container.querySelector(id); if (el) el.addEventListener('click', fn); };
    on('#pzLaunchMtools', () => this.launch('Mtools'));
    on('#pzLaunchPdm', () => this.launch('PDM'));
    on('#pzOpenDir', () => this.openDir());
    on('#pzRefresh', () => this.refreshCaptures());

    // 视图切换
    on('#pzBackFromCurve', () => this.switchView('console'));
    on('#pzBackFromPd', () => this.switchView('console'));
    on('#pzSwitchToPd', () => {
      const base = (this.activeFile || '').replace(/\.db$/i, '');
      const candidate = `${base}.sqlite`;
      this.openPdViewer(candidate);
    });
    on('#pzSwitchToCurve', () => {
      const base = (this.activeFile || '').replace(/\.sqlite$/i, '');
      const candidate = `${base}.db`;
      this.openCurveViewer(candidate);
    });
    on('#pzReloadCurve', () => {
      if (this.activeFile) this.openCurveViewer(this.activeFile);
    });

    // 折叠 HUD 看板 (^)
    on('#pzHudToggleBtn', () => {
      this.hudCollapsed = !this.hudCollapsed;
      const hud = this.container.querySelector('#pzHudGrid');
      const btn = this.container.querySelector('#pzHudToggleBtn');
      if (hud) hud.classList.toggle('collapsed', this.hudCollapsed);
      if (btn) btn.classList.toggle('collapsed', this.hudCollapsed);
      setTimeout(() => this.drawMainChart(), 260);
    });

    // 电流方向指示翻转 (⬅)
    on('#pzHudDirBtn', () => {
      this.reverseCurrent = !this.reverseCurrent;
      const btn = this.container.querySelector('#pzHudDirBtn');
      if (btn) btn.textContent = this.reverseCurrent ? '➔' : '⬅';
      this.updateHudWithLatest();
      this.drawMainChart();
    });

    // 曲线内容设置展开浮窗菜单控制 (10项功能)
    on('#pzContentMenuBtn', (e) => {
      e.stopPropagation();
      this.contentMenuOpen = !this.contentMenuOpen;
      const menu = this.container.querySelector('#pzContentMenu');
      const btn = this.container.querySelector('#pzContentMenuBtn');
      if (menu) menu.style.display = this.contentMenuOpen ? 'block' : 'none';
      if (btn) btn.classList.toggle('active', this.contentMenuOpen);
      if (this.contentMenuOpen) this.updateContentMenuUI();
    });

    on('#pzMenuItemSubChart', () => {
      this.showSubChart = !this.showSubChart;
      this.updateContentMenuUI();
      this.drawMainChart();
    });

    on('#pzMenuItemAbsCurrent', () => {
      this.useAbsCurrentStats = !this.useAbsCurrentStats;
      this.updateContentMenuUI();
      this.updateStatisticsTable();
    });

    on('#pzMenuItemStats', () => {
      this.showStats = !this.showStats;
      this.updateContentMenuUI();
      const statsBox = this.container.querySelector('#pzStatsOverlay');
      if (statsBox) statsBox.style.display = this.showStats ? 'block' : 'none';
    });

    on('#pzMenuItemExtremes', () => {
      this.showExtremes = !this.showExtremes;
      this.updateContentMenuUI();
      this.drawMainChart();
    });

    on('#pzMenuItemRateBoost', () => {
      this.highSampleRateBoost = !this.highSampleRateBoost;
      this.updateContentMenuUI();
      this.log(`高采样率刷新率增强已${this.highSampleRateBoost ? '开启' : '关闭'}`);
    });

    // 测量功能开启与关闭 (收纳于左上角曲线内容设置菜单内)
    on('#pzMenuItemMeasure', () => {
      this.measureEnabled = !this.measureEnabled;
      this.updateContentMenuUI();
      const diffBox = this.container.querySelector('#pzDiffOverlay');
      if (diffBox) diffBox.style.display = this.measureEnabled ? 'block' : 'none';
      this.drawMainChart();
      this.updateStatisticsTable();
    });

    on('#pzMenuItemImport', () => {
      this.closeContentMenu();
      this.importCapture();
    });

    on('#pzMenuItemExport', () => {
      this.closeContentMenu();
      this.exportCsv();
    });

    on('#pzMenuItemSavePic', () => {
      this.closeContentMenu();
      this.saveChartImage();
    });

    on('#pzMenuItemParams', () => {
      this.closeContentMenu();
      this.openSettingsModal();
    });

    // 点击菜单外部自动关闭浮窗
    document.addEventListener('click', (e) => {
      if (!this.contentMenuOpen) return;
      const menu = this.container.querySelector('#pzContentMenu');
      const btn = this.container.querySelector('#pzContentMenuBtn');
      if (menu && !menu.contains(e.target) && !btn?.contains(e.target)) {
        this.closeContentMenu();
      }
    });

    // 曲线通道勾选
    const bindToggle = (id, chs) => {
      const btn = this.container.querySelector(id);
      if (btn) btn.addEventListener('click', () => {
        const anyActive = chs.some(k => this.channels[k].enabled);
        chs.forEach(k => { this.channels[k].enabled = !anyActive; });
        btn.classList.toggle('active', !anyActive);
        this.drawMainChart();
      });
    };
    bindToggle('#pzToggleDpDm', ['dp', 'dm']);
    bindToggle('#pzToggleCc', ['cc1', 'cc2']);
    bindToggle('#pzToggleTemp', ['temp']);

    // 设置弹窗 (图1)
    on('#pzSettingsBtn', () => this.openSettingsModal());
    on('#pzCloseSettings', () => this.closeSettingsModal());
    const mask = this.container.querySelector('#pzSettingsModal');
    if (mask) mask.addEventListener('click', (e) => {
      if (e.target === mask) this.closeSettingsModal();
    });

    const selVbus = this.container.querySelector('#pzSelVbusScale');
    if (selVbus) selVbus.addEventListener('change', (e) => {
      this.vbusScaleMode = e.target.value;
      this.drawMainChart();
    });
    const selIbus = this.container.querySelector('#pzSelIbusScale');
    if (selIbus) selIbus.addEventListener('change', (e) => {
      this.ibusScaleMode = e.target.value;
      this.drawMainChart();
    });

    // PD 过滤输入
    const filterInput = this.container.querySelector('#pzPdFilter');
    if (filterInput) {
      filterInput.addEventListener('input', (e) => {
        this.filterText = e.target.value.trim().toLowerCase();
        this.renderPdTable();
      });
    }

    // 曲线鼠标悬浮、拖拽测量轴、滚轮缩放与平移时间轴
    const mainCanvas = this.container.querySelector('#pzMainCanvas');
    if (mainCanvas) {
      mainCanvas.addEventListener('mousedown', (e) => this.handleChartMouseDown(e));
      mainCanvas.addEventListener('mousemove', (e) => this.handleChartMouseMove(e));
      mainCanvas.addEventListener('wheel', (e) => this.handleChartWheel(e), { passive: false });
      mainCanvas.addEventListener('dblclick', () => {
        this.curveWindow = [0, 1];
        this.updateSliderWindowPos();
        this.drawMainChart();
        this.updateStatisticsTable();
      });
      mainCanvas.addEventListener('mouseleave', () => {
        this.hoverPoint = null;
        this.hoveringCursor = null;
        this.drawMainChart();
        this.updateHudWithLatest();
      });
      window.addEventListener('mouseup', () => {
        this.draggingCursor = null;
        this.draggingCanvas = false;
        if (mainCanvas && !this.hoveringCursor) mainCanvas.style.cursor = 'crosshair';
      });
    }

    // 底部缩略图拖拽缩放交互
    this.bindOverviewSlider();

    // PD 分栏调节器 (尺寸预设按钮 + 拖拽拉伸)
    this.bindPdSplitters();

    // 同步波形图交互 (悬停十字光标显数 + 点击就近定位报文)
    const wfCanvas = this.container.querySelector('#pzPdWaveformCanvas');
    if (wfCanvas) {
      wfCanvas.addEventListener('mousemove', (e) => this.handleWfMouseMove(e));
      wfCanvas.addEventListener('mouseleave', () => this.handleWfMouseLeave());
      wfCanvas.addEventListener('click', (e) => this.handleWfClick(e));
    }
  }

  bindPdSplitters() {
    const hSplitter = this.container.querySelector('#pzPdHSplitter');
    const lowerSplit = this.container.querySelector('#pzPdLowerSplit');
    const vSplitter = this.container.querySelector('#pzPdVSplitter');
    const detailPane = this.container.querySelector('#pzPdDetailPane');

    if (!lowerSplit) return;

    if (this.pdLowerHeight) {
      lowerSplit.style.setProperty('height', `${this.pdLowerHeight}px`, 'important');
      lowerSplit.style.setProperty('flex-basis', `${this.pdLowerHeight}px`, 'important');
    }
    if (this.pdDetailRatio && detailPane) {
      detailPane.style.setProperty('flex', `0 0 ${this.pdDetailRatio}%`, 'important');
      detailPane.style.setProperty('width', `${this.pdDetailRatio}%`, 'important');
    }

    // 水平分栏点状把手拖拽自由调节 (上下拖动调节高度)
    if (hSplitter) {
      let isDraggingH = false;
      let startY = 0;
      let startH = 0;

      const onHMove = (ev) => {
        if (!isDraggingH) return;
        ev.preventDefault();
        const clientY = ev.clientY != null ? ev.clientY : (ev.touches && ev.touches[0]?.clientY);
        if (clientY == null) return;
        const dy = startY - clientY; // 向上拖拽拉高下栏，向下拖拽收缩下栏
        const nextH = Math.max(60, Math.min(650, startH + dy));
        lowerSplit.style.setProperty('height', `${nextH}px`, 'important');
        lowerSplit.style.setProperty('flex-basis', `${nextH}px`, 'important');
        this.pdLowerHeight = nextH;
        requestAnimationFrame(() => this.drawPdWaveform());
      };

      const onHUp = () => {
        if (!isDraggingH) return;
        isDraggingH = false;
        hSplitter.classList.remove('is-dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onHMove);
        document.removeEventListener('mouseup', onHUp);
        document.removeEventListener('pointermove', onHMove);
        document.removeEventListener('pointerup', onHUp);
        window.removeEventListener('mousemove', onHMove);
        window.removeEventListener('mouseup', onHUp);
        this.drawPdWaveform();
      };

      const startHDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        isDraggingH = true;
        hSplitter.classList.add('is-dragging');
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';
        startY = e.clientY != null ? e.clientY : (e.touches && e.touches[0]?.clientY);
        startH = lowerSplit.getBoundingClientRect().height || lowerSplit.offsetHeight || 190;

        document.addEventListener('mousemove', onHMove);
        document.addEventListener('mouseup', onHUp);
        document.addEventListener('pointermove', onHMove);
        document.addEventListener('pointerup', onHUp);
        window.addEventListener('mousemove', onHMove);
        window.addEventListener('mouseup', onHUp);
      };

      hSplitter.addEventListener('mousedown', startHDrag);
      hSplitter.addEventListener('pointerdown', startHDrag);
    }

    // 垂直分栏点状把手拖拽自由调节 (左右拖动调节宽比)
    if (vSplitter && detailPane) {
      let isDraggingV = false;
      let startX = 0;
      let startW = 0;
      let totalW = 0;

      const onVMove = (ev) => {
        if (!isDraggingV) return;
        ev.preventDefault();
        const clientX = ev.clientX != null ? ev.clientX : (ev.touches && ev.touches[0]?.clientX);
        if (clientX == null) return;
        const dx = clientX - startX;
        const nextW = Math.max(140, Math.min(totalW - 140, startW + dx));
        const pct = Math.max(15, Math.min(85, (nextW / totalW) * 100));
        detailPane.style.setProperty('flex', `0 0 ${pct}%`, 'important');
        detailPane.style.setProperty('width', `${pct}%`, 'important');
        this.pdDetailRatio = pct;
        requestAnimationFrame(() => this.drawPdWaveform());
      };

      const onVUp = () => {
        if (!isDraggingV) return;
        isDraggingV = false;
        vSplitter.classList.remove('is-dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onVMove);
        document.removeEventListener('mouseup', onVUp);
        document.removeEventListener('pointermove', onVMove);
        document.removeEventListener('pointerup', onVUp);
        window.removeEventListener('mousemove', onVMove);
        window.removeEventListener('mouseup', onVUp);
        this.drawPdWaveform();
      };

      const startVDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        isDraggingV = true;
        vSplitter.classList.add('is-dragging');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        startX = e.clientX != null ? e.clientX : (e.touches && e.touches[0]?.clientX);
        startW = detailPane.getBoundingClientRect().width || detailPane.offsetWidth;
        totalW = lowerSplit.getBoundingClientRect().width || lowerSplit.offsetWidth || 1;

        document.addEventListener('mousemove', onVMove);
        document.addEventListener('mouseup', onVUp);
        document.addEventListener('pointermove', onVMove);
        document.addEventListener('pointerup', onVUp);
        window.addEventListener('mousemove', onVMove);
        window.addEventListener('mouseup', onVUp);
      };

      vSplitter.addEventListener('mousedown', startVDrag);
      vSplitter.addEventListener('pointerdown', startVDrag);
    }
  }

  switchView(mode) {
    this.currentMode = mode;
    const vMain = this.container.querySelector('#pzMainView');
    const vCurve = this.container.querySelector('#pzCurveView');
    const vPd = this.container.querySelector('#pzPdView');
    if (vMain) {
      vMain.classList.toggle('is-active', mode === 'console');
      vMain.style.display = mode === 'console' ? 'flex' : 'none';
    }
    if (vCurve) {
      vCurve.classList.toggle('is-active', mode === 'curve');
      vCurve.style.display = mode === 'curve' ? 'flex' : 'none';
    }
    if (vPd) {
      vPd.classList.toggle('is-active', mode === 'pd');
      vPd.style.display = mode === 'pd' ? 'flex' : 'none';
    }

    if (mode === 'curve') {
      requestAnimationFrame(() => {
        this.drawMainChart();
        this.drawOverviewChart();
      });
    } else if (mode === 'pd') {
      requestAnimationFrame(() => {
        this.drawPdWaveform();
      });
    }
  }

  log(msg) {
    const el = this.container.querySelector('#pzLog');
    if (!el) return;
    const d = document.createElement('div');
    d.textContent = `[${new Date().toTimeString().split(' ')[0]}] ${msg}`;
    el.appendChild(d);
    el.scrollTop = el.scrollHeight;
  }

  async request(endpoint, body) {
    const res = await fetch(this.companionBaseUrl + endpoint, body === undefined ? {} : {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const json = await res.json();
    if (!res.ok || json.ok === false) throw new Error(json.error || json.message || '请求失败');
    return json;
  }

  async launch(tool) {
    const button = this.container.querySelector(tool === 'PDM' ? '#pzLaunchPdm' : '#pzLaunchMtools');
    if (button) button.disabled = true;
    try {
      const json = await this.request('/api/powerz/control', { action: 'launch', tool });
      const result = json.result || {};
      if (!result.ok) throw new Error(result.message || result.error || '启动失败');
      this.log('已启动 ' + tool);
      await this.refreshCaptures();
    } catch (err) { this.log('启动失败：' + err.message); }
    finally { if (button) button.disabled = false; }
  }

  async openDir() {
    try {
      const json = await this.request('/api/powerz/control', { action: 'openCaptureDir' });
      if (!json.result?.ok) throw new Error(json.result?.message || '打开失败');
    } catch (err) { this.log('打开失败：' + err.message); }
  }

  async refreshCaptures({ silent = false } = {}) {
    if (this._destroyed || this._refreshing) return;
    const box = this.container.querySelector('#pzList');
    if (!box) return;
    this._refreshing = true;
    try {
      const json = await this.request('/api/powerz/captures');
      if (this._destroyed) return;
      const list = json.data || [];
      const archive = json.archive;
      if (archive) {
        const statusEl = this.container.querySelector('#pzArchiveState');
        const labels = { watching: '监测中', saving: '保存中', archiving: '存档中', archived: '已存档', empty: '无报文', stopped: '未启动' };
        const adc = archive.adc;
        const adcLabels = { ...labels, recording: '采集中', empty: '无采样' };
        const pending = ['saving', 'recording', 'archiving', 'retry', 'error', 'conflict', 'empty'];
        const selected = adc && pending.includes(adc.status) ? adc : archive;
        if (statusEl) {
          statusEl.textContent = (selected === adc ? adcLabels : labels)[selected.status] || '待存档';
          statusEl.title = selected.error || selected.lastArchive || '';
        }
      }
      this.captureDir = json.storage?.captureDir || this.captureDir;
      const dirEl = this.container.querySelector('#pzDir');
      if (dirEl) {
        dirEl.textContent = this.captureDir ? this.captureDir.split(/[\\/]/).filter(Boolean).pop() : '未配置';
        dirEl.title = this.captureDir;
      }
      const signature = JSON.stringify(list.map(f => [f.name, f.size, f.path]));
      if (signature === this._listSignature) return;
      this._listSignature = signature;
      box.replaceChildren();
      if (!list.length) {
        const empty = document.createElement('div');
        empty.className = 'pz-empty';
        empty.textContent = '暂无记录';
        box.appendChild(empty);
        return;
      }
      for (const file of list) {
        const item = document.createElement('div');
        item.className = 'pz-item';
        item.title = file.path;

        const isDb = /\.db$/i.test(file.name);
        const isSqlite = /\.sqlite$/i.test(file.name);

        const info = document.createElement('div');
        info.className = 'pz-item-info';

        const tag = document.createElement('span');
        tag.className = 'pz-item-tag ' + (isDb ? 'pz-tag-db' : isSqlite ? 'pz-tag-pd' : 'pz-tag-other');
        tag.textContent = isDb ? '📈 曲线' : isSqlite ? '⚡ 协议' : '文件';

        const name = document.createElement('span');
        name.className = 'pz-item-name';
        name.textContent = file.name;
        info.append(tag, name);

        const meta = document.createElement('div');
        meta.className = 'pz-item-meta';

        const size = document.createElement('span');
        size.className = 'sz';
        size.textContent = (file.size / 1048576).toFixed(2) + 'MB';

        const parseBtn = document.createElement('button');
        parseBtn.className = 'pz-btn sm';
        parseBtn.textContent = isDb ? '📈 解析' : isSqlite ? '⚡ 分析' : '查看';
        parseBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openCaptureFile(file.name);
        });

        meta.append(size, parseBtn);
        item.append(info, meta);

        item.addEventListener('click', () => this.openCaptureFile(file.name));
        box.appendChild(item);
      }
    } catch (err) {
      if (!silent) box.textContent = '加载失败';
    } finally { this._refreshing = false; }
  }

  async openCaptureFile(fileName) {
    if (/\.sqlite$/i.test(fileName)) {
      await this.openPdViewer(fileName);
    } else {
      await this.openCurveViewer(fileName);
    }
  }

  // =========================================================================
  // 图2: 数据记录仪 (Curve Viewer) 1:1 核心渲染逻辑
  // =========================================================================

  async openCurveViewer(fileName) {
    this.activeFile = fileName;
    this.switchView('curve');
    const lbl = this.container.querySelector('#pzCurveFileLabel');
    if (lbl) lbl.textContent = fileName;

    this.curveData = null;
    this.curveWindow = [0, 1];
    this.hoverPoint = null;
    this.t1Ratio = 0.446;
    this.t2Ratio = 0.597;

    try {
      this.log(`正在解析曲线数据: ${fileName} ...`);
      const res = await fetch(`${this.companionBaseUrl}/api/powerz/parse-curve?file=${encodeURIComponent(fileName)}&points=50000`);
      const json = await res.json();
      if (!res.ok || json.ok === false || !json.data) throw new Error(json.error || '获取曲线数据失败');

      this.curveData = json.data;
      this.renderCurveParamHeader();
      this.updateHudWithLatest();
      this.updateStatisticsTable();
      this.drawMainChart();
      this.drawOverviewChart();
      this.log(`曲线解析成功: ${fileName} (${this.curveData.totalSamples || 0} 采样点)`);
    } catch (err) {
      this.log(`曲线解析失败: ${err.message}`);
    }
  }

  renderCurveParamHeader() {
    if (!this.curveData) return;
    const p = this.curveData.param || {};
    const titleEl = this.container.querySelector('#pzChartParamTitle');
    if (titleEl) titleEl.textContent = p.name || 'Simple Real-Time Chart';
  }

  /** 数字微距排版: 1:1 还原图2带空格的读数 (如 9.528 892 V, 3.845 551 A) */
  static formatDigits(val, unit = '', decimals = 6) {
    if (val == null || isNaN(val)) return '0.000 000 ' + unit;
    const s = Number(val).toFixed(decimals);
    const [intPart, decPart] = s.split('.');
    if (decPart && decPart.length >= 6) {
      return `${intPart}.${decPart.slice(0, 3)} ${decPart.slice(3, 6)} ${unit}`.trim();
    }
    return `${s} ${unit}`.trim();
  }

  static formatPower(pwr) {
    if (pwr == null || isNaN(pwr)) return '0.000 00W';
    const s = Number(pwr).toFixed(5);
    const [intPart, decPart] = s.split('.');
    return `${intPart}.${decPart.slice(0, 3)} ${decPart.slice(3, 5)}W`;
  }

  updateHudWithLatest(point = null) {
    if (!this.curveData) return;
    const pt = point || this.curveData.latest || (this.curveData.points && this.curveData.points.at(-1)) || {};

    const curI = this.reverseCurrent ? -(pt.i || 0) : (pt.i || 0);
    const curP = pt.p != null ? pt.p : ((pt.v || 0) * Math.abs(curI));

    const setText = (id, txt) => { const el = this.container.querySelector(id); if (el) el.textContent = txt; };
    setText('#pzHudVbus', PowerzPanel.formatDigits(pt.v, 'V', 6));
    setText('#pzHudIbus', PowerzPanel.formatDigits(curI, 'A', 6));
    setText('#pzHudPwr', PowerzPanel.formatPower(curP));

    setText('#pzHudDp', pt.dp != null ? `${Number(pt.dp).toFixed(3)}V` : 'na');
    setText('#pzHudDm', pt.dm != null ? `${Number(pt.dm).toFixed(3)}V` : 'na');
    setText('#pzHudCc1', pt.cc1 != null ? `${Number(pt.cc1).toFixed(3)}V` : 'na');
    setText('#pzHudCc2', pt.cc2 != null ? `${Number(pt.cc2).toFixed(3)}V` : 'na');
  }

  updateStatisticsTable() {
    if (!this.curveData) return;
    const pts = this.curveData.points || [];
    const m = this.curveData.metrics || {};
    const totalPts = this.curveData.totalSamples || pts.length || 0;
    const dur = Math.round(this.curveData.durationSeconds || ((pts.at(-1)?.t || 0) - (pts[0]?.t || 0)));

    const fmtTime = (sec) => {
      const s = Math.floor(sec);
      const h = Math.floor(s / 3600);
      const min = Math.floor((s % 3600) / 60);
      const rem = s % 60;
      return `${h}:${min}:${rem}`;
    };

    const setText = (id, txt) => { const el = this.container.querySelector(id); if (el) el.textContent = txt; };
    // 全部统计 (图2 绿底 全部)
    setText('#pzStatAllTime', fmtTime(dur));
    setText('#pzStatAllAh', m.capacityMah != null ? (m.capacityMah / 1000).toFixed(4) : '0.0228');
    setText('#pzStatAllWh', m.energyMwh != null ? (m.energyMwh / 1000).toFixed(4) : '0.2066');
    setText('#pzStatAllPts', String(totalPts));

    // 显示统计开关
    const statsOverlay = this.container.querySelector('#pzStatsOverlay');
    if (statsOverlay) statsOverlay.style.display = this.showStats ? 'block' : 'none';

    // 窗口统计 (基于测量区间或当前视窗缩放窗口)
    if (this.measureEnabled && pts.length >= 2) {
      // 开启测量功能时：移动测量轴即可完成区间的精确参数测量
      const totalDur = (pts.at(-1)?.t || 1) - (pts[0]?.t || 0);
      const absT1 = (pts[0]?.t || 0) + totalDur * this.t1Ratio;
      const absT2 = (pts[0]?.t || 0) + totalDur * this.t2Ratio;
      const minT = Math.min(absT1, absT2);
      const maxT = Math.max(absT1, absT2);
      const diffT = maxT - minT;

      let ptsInInterval = 0;
      let sumAh = 0;
      let sumWh = 0;
      let prevT = null;

      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (p.t >= minT && p.t <= maxT) {
          ptsInInterval++;
          if (prevT !== null) {
            const dt = p.t - prevT;
            if (dt > 0 && dt < 1.0) {
              const effI = this.useAbsCurrentStats ? Math.abs(p.i) : p.i;
              sumAh += (Math.abs(effI) * dt) / 3600;
              sumWh += ((p.v * effI) * dt) / 3600;
            }
          }
          prevT = p.t;
        }
      }

      setText('#pzStatWinTime', fmtTime(diffT));
      setText('#pzStatWinAh', sumAh.toFixed(4));
      setText('#pzStatWinWh', sumWh.toFixed(4));
      setText('#pzStatWinPts', String(ptsInInterval));
    } else {
      // 测量关闭时：统计当前缩放视窗
      const [startR, endR] = this.curveWindow;
      const winRatio = Math.max(0.0001, endR - startR);
      const winPts = Math.round(totalPts * winRatio);
      const winDur = dur * winRatio;
      setText('#pzStatWinTime', fmtTime(winDur));
      setText('#pzStatWinAh', m.capacityMah != null ? ((m.capacityMah / 1000) * winRatio).toFixed(4) : '0.0000');
      setText('#pzStatWinWh', m.energyMwh != null ? ((m.energyMwh / 1000) * winRatio).toFixed(4) : '0.0000');
      setText('#pzStatWinPts', String(winPts));
    }
  }

  closeContentMenu() {
    this.contentMenuOpen = false;
    const menu = this.container.querySelector('#pzContentMenu');
    const btn = this.container.querySelector('#pzContentMenuBtn');
    if (menu) menu.style.display = 'none';
    if (btn) btn.classList.remove('active');
  }

  updateContentMenuUI() {
    const setChk = (idCheck, idItem, checked) => {
      const elChk = this.container.querySelector(idCheck);
      const elItem = this.container.querySelector(idItem);
      if (elChk) elChk.textContent = checked ? '✓' : '';
      if (elItem) elItem.classList.toggle('checked', !!checked);
    };
    setChk('#pzCheckSubChart', '#pzMenuItemSubChart', this.showSubChart);
    setChk('#pzCheckAbsCurrent', '#pzMenuItemAbsCurrent', this.useAbsCurrentStats);
    setChk('#pzCheckStats', '#pzMenuItemStats', this.showStats);
    setChk('#pzCheckExtremes', '#pzMenuItemExtremes', this.showExtremes);
    setChk('#pzCheckRateBoost', '#pzMenuItemRateBoost', this.highSampleRateBoost);
    setChk('#pzCheckMeasure', '#pzMenuItemMeasure', this.measureEnabled);
  }

  exportCsv() {
    if (!this.curveData || !this.curveData.points || !this.curveData.points.length) {
      this.log('无有效曲线数据可导出');
      return;
    }
    const pts = this.curveData.points;
    const [wStart, wEnd] = this.curveWindow;
    const idx0 = Math.max(0, Math.floor(pts.length * wStart));
    const idx1 = Math.min(pts.length - 1, Math.ceil(pts.length * wEnd));
    const slice = pts.slice(idx0, idx1 + 1);

    let csv = 'Index,Time_s,VBUS_V,IBUS_A,PWR_W,DP_V,DM_V,CC1_V,CC2_V,Temp_C\r\n';
    for (let i = 0; i < slice.length; i++) {
      const p = slice[i];
      const curI = this.reverseCurrent ? -p.i : p.i;
      const curP = p.p != null ? p.p : (p.v * Math.abs(curI));
      csv += `${idx0 + i},${p.t.toFixed(4)},${p.v.toFixed(6)},${curI.toFixed(6)},${curP.toFixed(5)},${(p.dp ?? 0).toFixed(4)},${(p.dm ?? 0).toFixed(4)},${(p.cc1 ?? 0).toFixed(4)},${(p.cc2 ?? 0).toFixed(4)},${(p.temp ?? 0).toFixed(2)}\r\n`;
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PowerZ_${(this.activeFile || 'curve').replace(/\.[^/.]+$/, '')}_export.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.log(`数据已导出至 CSV (${slice.length} 行)`);
  }

  saveChartImage() {
    const canvas = this.container.querySelector('#pzMainCanvas');
    if (!canvas) return;
    try {
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `PowerZ_${(this.activeFile || 'chart').replace(/\.[^/.]+$/, '')}_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      this.log('图表图片已保存');
    } catch (err) {
      this.log('保存图片失败: ' + err.message);
    }
  }

  importCapture() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.db,.sqlite';
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (file) {
        this.log(`已选择文件: ${file.name}`);
        this.openCaptureFile(file.name);
      }
    };
    input.click();
  }

  /** 计算优雅对称刻度区间 (1:1 对齐图2: 0..11.000V 步进 0.500V; 0..4.600A 步进 0.200A) */
  static computeAxisTicks(minVal, maxVal, alwaysIncludeZero = true, targetTicks = 22) {
    let lower = alwaysIncludeZero ? Math.min(0.0, minVal) : minVal;
    let upper = alwaysIncludeZero ? Math.max(0.0, maxVal) : maxVal;
    let span = upper - lower;
    if (span <= 1e-9) span = 1.0;

    let roughStep = span / targetTicks;
    let exponent = Math.floor(Math.log10(roughStep));
    let fraction = roughStep / Math.pow(10, exponent);
    let step;
    if (fraction <= 1.5) step = 1.0 * Math.pow(10, exponent);
    else if (fraction <= 3.0) step = 2.0 * Math.pow(10, exponent);
    else if (fraction <= 7.0) step = 5.0 * Math.pow(10, exponent);
    else step = 10.0 * Math.pow(10, exponent);

    let start = Math.floor(lower / step) * step;
    let end = Math.ceil(upper / step) * step;
    // 增加 1~2 步的顶部空间以完全匹配图2头部裕量
    if (upper > end - step * 0.4) end += step;

    let ticks = [];
    for (let c = start; c <= end + step * 0.001; c += step) {
      ticks.push(Number(c.toFixed(6)));
    }
    return { start, end: ticks.at(-1) || end, step, ticks };
  }

  drawMainChart() {
    const canvas = this.container.querySelector('#pzMainCanvas');
    if (!canvas || !this.curveData || !this.curveData.points) return;
    const pts = this.curveData.points;
    if (!pts.length) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);

    const ctx = canvas.getContext('2d');
    ctx.resetTransform?.();
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;

    // 1. 深色主背景 (与官方完全一致的深邃纯黑 #05070a)
    ctx.fillStyle = '#05070a';
    ctx.fillRect(0, 0, W, H);

    // 2. 截取视窗内数据
    const [wStart, wEnd] = this.curveWindow;
    const idx0 = Math.max(0, Math.floor(pts.length * wStart));
    const idx1 = Math.min(pts.length - 1, Math.ceil(pts.length * wEnd));
    const slice = pts.slice(idx0, idx1 + 1);
    if (slice.length < 2) return;

    // 边距: 左VBUS(60px), 右IBUS(58px), 顶部(20px), 底部时间轴(26px)
    const padL = 60, padR = 58, padT = 20, padB = 26;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    // 3. 计算极值与自适应刻度
    let minV = Infinity, maxV = -Infinity;
    let minI = Infinity, maxI = -Infinity;
    for (const p of slice) {
      if (p.v < minV) minV = p.v; if (p.v > maxV) maxV = p.v;
      const iVal = this.reverseCurrent ? -p.i : p.i;
      if (iVal < minI) minI = iVal; if (iVal > maxI) maxI = iVal;
    }

    const isAutoZeroV = this.vbusScaleMode === 'auto2';
    const isAutoZeroI = this.ibusScaleMode === 'auto2';
    const vAxis = PowerzPanel.computeAxisTicks(minV, maxV, isAutoZeroV, 22);
    const iAxis = PowerzPanel.computeAxisTicks(minI, maxI, isAutoZeroI, 23);

    const t0 = slice[0].t;
    const t1 = slice.at(-1).t;
    const spanT = t1 - t0 || 1;

    const isSub = this.showSubChart;
    const mainPlotH = isSub ? Math.floor(plotH * 0.52) : plotH;
    const subPadT = isSub ? padT + mainPlotH + 18 : 0;
    const subPlotH = isSub ? plotH - mainPlotH - 18 : 0;

    const subAxis = isSub ? PowerzPanel.computeAxisTicks(0, 3.5, true, 7) : null;

    const xCoord = (t) => padL + ((t - t0) / spanT) * plotW;
    const yCoordV = (v) => padT + mainPlotH - ((v - vAxis.start) / (vAxis.end - vAxis.start)) * mainPlotH;
    const yCoordI = (i) => padT + mainPlotH - ((i - iAxis.start) / (iAxis.end - iAxis.start)) * mainPlotH;
    const yCoordSub = isSub ? ((v) => subPadT + subPlotH - ((v - subAxis.start) / (subAxis.end - subAxis.start)) * subPlotH) : yCoordV;

    // 4. 绘制细微网格线 (清晰像素对齐，颜色 #1a1d26)
    ctx.strokeStyle = '#1a1d26';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);

    // 主图水平网格线与 Y 轴刻度标签
    vAxis.ticks.forEach(tv => {
      const y = Math.round(yCoordV(tv)) + 0.5;
      if (y >= padT && y <= padT + mainPlotH) {
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(W - padR, y);
        ctx.stroke();

        // 左 Y 轴刻度文字 (官方 Segoe UI 字体: 11.000V, 0.500V)
        ctx.fillStyle = '#8f9bb3';
        ctx.font = '10px "Segoe UI", -apple-system, Arial, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`${tv.toFixed(tv < 0.05 && tv > 0 ? 4 : 3)}V`, padL - 6, y + 3.5);
      }
    });

    // 右 Y 轴 IBUS 刻度文字 (官方 Segoe UI 字体: 4.600A, 0.200A)
    iAxis.ticks.forEach(ti => {
      const y = Math.round(yCoordI(ti)) + 0.5;
      if (y >= padT && y <= padT + mainPlotH) {
        ctx.fillStyle = '#8f9bb3';
        ctx.font = '10px "Segoe UI", -apple-system, Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${ti.toFixed(ti < 0.05 && ti > 0 ? 4 : 3)}A`, W - padR + 6, y + 3.5);
      }
    });

    // 副图分屏网格线与刻度 (图2: 0..3.5V 步进 0.500V)
    if (isSub && subAxis) {
      // 主副图水平分割线
      ctx.strokeStyle = '#222838';
      ctx.beginPath();
      ctx.moveTo(padL, padT + mainPlotH + 9);
      ctx.lineTo(W - padR, padT + mainPlotH + 9);
      ctx.stroke();

      ctx.strokeStyle = '#1a1d26';
      subAxis.ticks.forEach(tsv => {
        const y = Math.round(yCoordSub(tsv)) + 0.5;
        if (y >= subPadT && y <= subPadT + subPlotH) {
          ctx.beginPath();
          ctx.moveTo(padL, y);
          ctx.lineTo(W - padR, y);
          ctx.stroke();

          ctx.fillStyle = '#8f9bb3';
          ctx.font = '10px "Segoe UI", -apple-system, Arial, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(`${tsv.toFixed(3)}V`, padL - 6, y + 3.5);
        }
      });
    }

    // X 轴时间分割线 (自适应大刻度，对齐 00:00:00.0)
    const niceStep = spanT <= 5 ? 0.5 : spanT <= 15 ? 1 : spanT <= 35 ? 2 : spanT <= 90 ? 5 : 10;
    const firstTick = Math.ceil(t0 / niceStep) * niceStep;
    for (let curT = firstTick; curT <= t1 + 0.001; curT += niceStep) {
      const x = Math.round(xCoord(curT)) + 0.5;
      if (x < padL || x > padL + plotW) continue;
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, padT + plotH);
      ctx.stroke();

      // 格式化 00:00:00.0 时间文本
      const totalSec = Math.max(0, curT);
      const secInt = Math.floor(totalSec);
      const msDec = Math.floor((totalSec - secInt) * 10);
      const hh = String(Math.floor(secInt / 3600)).padStart(2, '0');
      const mm = String(Math.floor((secInt % 3600) / 60)).padStart(2, '0');
      const ss = String(secInt % 60).padStart(2, '0');

      ctx.fillStyle = '#8f9bb3';
      ctx.font = '9.5px "Segoe UI", -apple-system, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${hh}:${mm}:${ss}.${msDec}`, x, padT + plotH + 14);
    }

    // X 轴中央底部标签 "Elapsed Time"
    ctx.fillStyle = '#5a6578';
    ctx.font = '10.5px "Segoe UI", -apple-system, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Elapsed Time', padL + plotW / 2, padT + plotH + 24);

    // 5. 绘制已启用的各通道曲线 (高保真抗锯齿)
    const drawCurve = (chKey, valAccessor, yFunc) => {
      const ch = this.channels[chKey];
      if (!ch || !ch.enabled) return;
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = ch.color;
      ctx.lineWidth = ch.width || 1.6;
      ctx.globalAlpha = ch.alpha || 1.0;
      ctx.lineJoin = 'bevel';
      ctx.lineCap = 'butt';

      let started = false;
      for (let i = 0; i < slice.length; i++) {
        const p = slice[i];
        const val = valAccessor(p);
        if (val == null || isNaN(val)) continue;
        const x = xCoord(p.t);
        const y = yFunc(val);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else { ctx.lineTo(x, y); }
      }
      ctx.stroke();
      ctx.restore();
    };

    if (isSub) {
      // 副图分屏模式 (图2: 上屏 VBUS/IBUS，下屏 DP/DM/CC1/CC2)
      drawCurve('vbus', (p) => p.v, yCoordV);
      drawCurve('ibus', (p) => (this.reverseCurrent ? -p.i : p.i), yCoordI);

      drawCurve('cc1', (p) => p.cc1, yCoordSub);
      drawCurve('cc2', (p) => p.cc2, yCoordSub);
      drawCurve('dp',  (p) => p.dp,  yCoordSub);
      drawCurve('dm',  (p) => p.dm,  yCoordSub);
      drawCurve('temp',(p) => p.temp,yCoordSub);
    } else {
      // 单图模式: 全通道统一坐标系
      drawCurve('cc1', (p) => p.cc1, yCoordV);
      drawCurve('cc2', (p) => p.cc2, yCoordV);
      drawCurve('dp',  (p) => p.dp,  yCoordV);
      drawCurve('dm',  (p) => p.dm,  yCoordV);
      drawCurve('temp',(p) => p.temp,yCoordV);
      drawCurve('vbus', (p) => p.v, yCoordV);
      drawCurve('ibus', (p) => (this.reverseCurrent ? -p.i : p.i), yCoordI);
    }

    // 6. 绘制图例 (■ VBUS ■ IBUS ...)
    ctx.font = 'bold 10px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';

    const renderLegendItem = (key, lx, ly) => {
      const ch = this.channels[key];
      if (!ch || !ch.enabled) return 0;
      ctx.fillStyle = ch.color;
      ctx.fillText(`■ ${ch.label}`, lx, ly);
      return ctx.measureText(`■ ${ch.label}`).width + 12;
    };

    if (isSub) {
      let lx1 = padL + 10;
      lx1 += renderLegendItem('vbus', lx1, padT + 14);
      lx1 += renderLegendItem('ibus', lx1, padT + 14);

      let lx2 = padL + 10;
      lx2 += renderLegendItem('dp', lx2, subPadT + 14);
      lx2 += renderLegendItem('dm', lx2, subPadT + 14);
      lx2 += renderLegendItem('cc1', lx2, subPadT + 14);
      lx2 += renderLegendItem('cc2', lx2, subPadT + 14);
      lx2 += renderLegendItem('temp', lx2, subPadT + 14);
    } else {
      let legendX = padL + 10;
      const legendY = padT + 14;
      ['vbus', 'ibus', 'dp', 'dm', 'cc1', 'cc2', 'temp'].forEach(k => {
        legendX += renderLegendItem(k, legendX, legendY);
      });
    }

    // 7. 显示极值 (图3: 动态极值指示 ▲ max / ▼ min)
    if (this.showExtremes) {
      const extX = padL + 10;
      const extY = padT + 26;
      const extW = 108;
      const extH = 68;

      ctx.save();
      ctx.fillStyle = 'rgba(10, 14, 22, 0.88)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(extX, extY, extW, extH, 4);
      ctx.fill();
      ctx.stroke();

      ctx.font = '10px "Segoe UI", Consolas, monospace';
      ctx.textBaseline = 'middle';

      // 1. VBUS 最大值 ▲ 9.794341V
      ctx.fillStyle = '#22c55e';
      ctx.fillText('▲', extX + 6, extY + 12);
      ctx.fillStyle = '#3cb371';
      ctx.fillText(`${maxV.toFixed(6)}V`, extX + 18, extY + 12);

      // 2. VBUS 最小值 ▼ 0.000290V
      ctx.fillStyle = '#ef4444';
      ctx.fillText('▼', extX + 6, extY + 28);
      ctx.fillStyle = '#3cb371';
      ctx.fillText(`${minV.toFixed(6)}V`, extX + 18, extY + 28);

      // 3. IBUS 最大值 ▲ 3.891452A
      ctx.fillStyle = '#22c55e';
      ctx.fillText('▲', extX + 6, extY + 44);
      ctx.fillStyle = '#ffb6c1';
      ctx.fillText(`${maxI.toFixed(6)}A`, extX + 18, extY + 44);

      // 4. IBUS 最小值 ▼ 0.000002A
      ctx.fillStyle = '#ef4444';
      ctx.fillText('▼', extX + 6, extY + 60);
      ctx.fillStyle = '#ffb6c1';
      ctx.fillText(`${minI.toFixed(6)}A`, extX + 18, extY + 60);

      ctx.restore();
    }

    // 8. 测量功能判断：开启时绘制双测量轴、交点 Badge 与右上差值框；关闭时隐藏
    if (this.measureEnabled) {
      this.renderDualCursors(ctx, slice, t0, spanT, xCoord, yCoordV, yCoordI, padL, plotW, padT, plotH, isSub ? yCoordSub : null);
      const diffBox = this.container.querySelector('#pzDiffOverlay');
      if (diffBox) diffBox.style.display = 'block';
    } else {
      const diffBox = this.container.querySelector('#pzDiffOverlay');
      if (diffBox) diffBox.style.display = 'none';
    }

    // 9. 鼠标悬停 Crosshair 与实时悬浮 Tooltip
    if (this.hoverPoint && !this.draggingCursor && !this.draggingCanvas) {
      const hx = xCoord(this.hoverPoint.t);
      const hyV = yCoordV(this.hoverPoint.v);
      const curI = this.reverseCurrent ? -this.hoverPoint.i : this.hoverPoint.i;
      const hyI = yCoordI(curI);

      ctx.save();
      ctx.setLineDash([2, 3]);
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hx, padT);
      ctx.lineTo(hx, padT + plotH);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = '#3cb371';
      ctx.beginPath(); ctx.arc(hx, hyV, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffb6c1';
      ctx.beginPath(); ctx.arc(hx, hyI, 3, 0, Math.PI * 2); ctx.fill();
      if (isSub && this.hoverPoint.dp != null) {
        ctx.fillStyle = '#7fff00';
        ctx.beginPath(); ctx.arc(hx, yCoordSub(this.hoverPoint.dp), 3, 0, Math.PI * 2); ctx.fill();
      }

      // Tooltip 浮动框
      const tipW = 118, tipH = 48;
      let tipX = hx + 10;
      if (tipX + tipW > W - padR) tipX = hx - tipW - 10;
      const tipY = Math.max(padT + 4, Math.min(hyV, hyI) - 15);

      ctx.fillStyle = 'rgba(15, 20, 28, 0.94)';
      ctx.strokeStyle = '#2f3647';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(tipX, tipY, tipW, tipH, 4);
      ctx.fill();
      ctx.stroke();

      const msTotal = Math.floor(this.hoverPoint.t * 1000);
      const s = Math.floor(msTotal / 1000);
      const remMs = String(msTotal % 1000).padStart(3, '0');
      const timeStr = `${Math.floor(s/3600)}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}.${remMs}`;

      ctx.font = '10px "Segoe UI", Consolas, monospace';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(timeStr, tipX + 8, tipY + 14);
      ctx.fillStyle = '#3cb371';
      ctx.fillText(`VBUS  ${this.hoverPoint.v.toFixed(6)}V`, tipX + 8, tipY + 28);
      ctx.fillStyle = '#ffb6c1';
      ctx.fillText(`IBUS  ${curI.toFixed(6)}A`, tipX + 8, tipY + 42);
    }
  }

  /** 1:1 绘制 T1 / T2 游标、各曲线交叉点彩色读数 Badge 及右上角差值面板 */
  renderDualCursors(ctx, slice, t0, spanT, xCoord, yCoordV, yCoordI, padL, plotW, padT, plotH, yCoordSub = null) {
    const totalDur = (this.curveData.points.at(-1)?.t || 1) - (this.curveData.points[0]?.t || 0);
    const absT1 = (this.curveData.points[0]?.t || 0) + totalDur * this.t1Ratio;
    const absT2 = (this.curveData.points[0]?.t || 0) + totalDur * this.t2Ratio;

    // 找到最邻近的样本点
    const findNearest = (targetT) => {
      let best = slice[0], minD = Infinity;
      for (const p of slice) {
        const d = Math.abs(p.t - targetT);
        if (d < minD) { minD = d; best = p; }
      }
      return best;
    };
    const p1 = findNearest(absT1);
    const p2 = findNearest(absT2);

    const drawOneCursor = (pt, label, isT1) => {
      if (!pt) return;
      const cx = Math.round(xCoord(pt.t)) + 0.5;
      if (cx < padL || cx > padL + plotW) return;

      const cursorKey = isT1 ? 't1' : 't2';
      const isHovered = this.hoveringCursor === cursorKey || this.draggingCursor === cursorKey;

      // 1. 垂直测量线 (悬停/拖拽时高亮为天蓝色)
      ctx.save();
      ctx.setLineDash(isHovered ? [] : [3, 3]);
      ctx.strokeStyle = isHovered ? '#38bdf8' : '#cbd5e1';
      ctx.lineWidth = isHovered ? 1.5 : 1.0;
      ctx.beginPath();
      ctx.moveTo(cx, padT);
      ctx.lineTo(cx, padT + plotH);
      ctx.stroke();
      ctx.restore();

      // 2. 底部 X 轴时间 Badge (如 00:00:11.576)
      const secInt = Math.floor(pt.t);
      const ms = String(Math.floor((pt.t - secInt) * 1000)).padStart(3, '0');
      const timeStr = `${String(Math.floor(secInt/3600)).padStart(2,'0')}:${String(Math.floor((secInt%3600)/60)).padStart(2,'0')}:${String(secInt%60).padStart(2,'0')}.${ms}`;

      ctx.save();
      ctx.font = 'bold 9.5px "Segoe UI", Arial, sans-serif';
      const bw = ctx.measureText(timeStr).width + 8;
      ctx.fillStyle = '#f8a5b0';
      ctx.strokeStyle = isHovered ? '#0284c7' : '#eb6877';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(cx - bw / 2, padT + plotH - 3, bw, 15, 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.fillText(timeStr, cx, padT + plotH + 8.5);
      ctx.restore();

      // 3. 在各通道曲线相交处绘制交点圆点与高亮带背景 Badge (1:1 还原图2)
      const drawPillBadge = (val, y, bgCol, dec = 4) => {
        if (val == null || isNaN(val)) return;
        const txt = Number(val).toFixed(dec);

        // 绘制曲线交点圆点
        ctx.beginPath();
        ctx.arc(cx, y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = bgCol;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();

        // 绘制带背景的数值徽章
        ctx.font = 'bold 9.5px "Segoe UI", Arial, sans-serif';
        const pw = ctx.measureText(txt).width + 6;
        ctx.fillStyle = bgCol;
        ctx.beginPath();
        ctx.roundRect(cx - pw / 2, y - 6, pw, 12, 2);
        ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.fillText(txt, cx, y + 3.5);
      };

      const curI = this.reverseCurrent ? -pt.i : pt.i;
      const ySub = yCoordSub || yCoordV;
      if (this.channels.vbus.enabled) drawPillBadge(pt.v, yCoordV(pt.v), '#3cb371', 4);
      if (this.channels.ibus.enabled) drawPillBadge(curI, yCoordI(curI), '#ffb6c1', 4);
      if (this.channels.dp.enabled)   drawPillBadge(pt.dp, ySub(pt.dp), '#7fff00', 3);
      if (this.channels.cc2.enabled)  drawPillBadge(pt.cc2, ySub(pt.cc2), '#20b2aa', 3);
      if (this.channels.cc1.enabled)  drawPillBadge(pt.cc1, ySub(pt.cc1), '#ffc0cb', 3);
      if (this.channels.dm.enabled)   drawPillBadge(pt.dm, ySub(pt.dm), '#ffe4b5', 3);
    };

    drawOneCursor(p1, 'T1', true);
    drawOneCursor(p2, 'T2', false);

    // 4. 更新右上角 T1-T2 差值表 (1:1 对齐图2数值)
    if (p1 && p2) {
      const diffT = Math.abs(p2.t - p1.t);
      const sec = Math.floor(diffT);
      const ms = String(Math.floor((diffT - sec) * 1000)).padStart(3, '0');
      const diffTimeStr = `${String(Math.floor(sec/3600)).padStart(2,'0')}:${String(Math.floor((sec%3600)/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}.${ms}`;

      const curI1 = this.reverseCurrent ? -p1.i : p1.i;
      const curI2 = this.reverseCurrent ? -p2.i : p2.i;

      const setText = (id, txt) => { const el = this.container.querySelector(id); if (el) el.textContent = txt; };
      setText('#pzDiffTime', diffTimeStr);
      setText('#pzDiffCc2', ((p2.cc2 || 0) - (p1.cc2 || 0)).toFixed(3));
      setText('#pzDiffCc1', ((p2.cc1 || 0) - (p1.cc1 || 0)).toFixed(3));
      setText('#pzDiffDm', ((p2.dm || 0) - (p1.dm || 0)).toFixed(3));
      setText('#pzDiffDp', ((p2.dp || 0) - (p1.dp || 0)).toFixed(3));
      setText('#pzDiffIbus', (curI2 - curI1).toFixed(6));
      setText('#pzDiffVbus', (p2.v - p1.v).toFixed(6));
    }
  }

  drawOverviewChart() {
    const canvas = this.container.querySelector('#pzOverviewCanvas');
    if (!canvas || !this.curveData) return;
    const overview = this.curveData.overview || [];
    if (!overview.length) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;

    ctx.fillStyle = '#0d0f14';
    ctx.fillRect(0, 0, W, H);

    let maxV = 0.001;
    for (const p of overview) if (p.v > maxV) maxV = p.v;

    // 绘制浅绿色微型趋势线
    ctx.beginPath();
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1.2;
    overview.forEach((p, idx) => {
      const x = (idx / (overview.length - 1)) * W;
      const y = H - (p.v / maxV) * (H - 12) - 10;
      if (idx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 绘制底部刻度时间
    const totalDur = (this.curveData.points.at(-1)?.t || 25);
    ctx.fillStyle = '#64748b';
    ctx.font = '8.5px Consolas, monospace';
    ctx.textAlign = 'center';
    for (let s = 0; s <= totalDur; s += 5) {
      const x = (s / totalDur) * W;
      const ss = String(s % 60).padStart(2, '0');
      const mm = String(Math.floor(s / 60)).padStart(2, '0');
      ctx.fillText(`00:${mm}:${ss}`, Math.max(16, Math.min(W - 16, x)), H - 2);
    }

    this.updateSliderWindowPos();
  }

  updateSliderWindowPos() {
    const winEl = this.container.querySelector('#pzSliderWindow');
    if (!winEl) return;
    const [startR, endR] = this.curveWindow;
    winEl.style.left = `${(startR * 100).toFixed(2)}%`;
    winEl.style.width = `${((endR - startR) * 100).toFixed(2)}%`;
  }

  bindOverviewSlider() {
    const wrap = this.container.querySelector('#pzOverviewWrap');
    const win = this.container.querySelector('#pzSliderWindow');
    if (!wrap || !win) return;

    let dragging = false;
    let startX = 0;
    let origStartR = 0, origSpan = 0;

    win.addEventListener('mousedown', (e) => {
      dragging = true;
      startX = e.clientX;
      origStartR = this.curveWindow[0];
      origSpan = this.curveWindow[1] - this.curveWindow[0];
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const rect = wrap.getBoundingClientRect();
      const deltaR = (e.clientX - startX) / rect.width;
      let newStart = Math.max(0, Math.min(1 - origSpan, origStartR + deltaR));
      let newEnd = newStart + origSpan;
      this.curveWindow = [newStart, newEnd];
      this.updateSliderWindowPos();
      this.drawMainChart();
      this.updateStatisticsTable();
    });

    window.addEventListener('mouseup', () => { dragging = false; });

    wrap.addEventListener('click', (e) => {
      if (e.target === win) return;
      const rect = wrap.getBoundingClientRect();
      const clickR = (e.clientX - rect.left) / rect.width;
      const span = this.curveWindow[1] - this.curveWindow[0];
      let newStart = Math.max(0, Math.min(1 - span, clickR - span / 2));
      this.curveWindow = [newStart, newStart + span];
      this.updateSliderWindowPos();
      this.drawMainChart();
      this.updateStatisticsTable();
    });
  }

  handleChartWheel(e) {
    if (!this.curveData || !this.curveData.points) return;
    const canvas = this.container.querySelector('#pzMainCanvas');
    if (!canvas) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const padL = 60, padR = 58;
    const plotW = rect.width - padL - padR;
    if (plotW <= 0) return;

    const [wStart, wEnd] = this.curveWindow;
    const currentSpan = wEnd - wStart;

    // Shift 滚轮：沿时间轴平移视窗
    if (e.shiftKey) {
      const panStep = (e.deltaY > 0 ? 0.05 : -0.05) * currentSpan;
      let newStart = Math.max(0, Math.min(1 - currentSpan, wStart + panStep));
      let newEnd = newStart + currentSpan;
      this.curveWindow = [newStart, newEnd];
      this.updateSliderWindowPos();
      this.drawMainChart();
      this.updateStatisticsTable();
      return;
    }

    // 缩放中心锚点 (以鼠标所在点为中心向内/向外缩放时间轴)
    const clampedX = Math.max(padL, Math.min(rect.width - padR, mouseX));
    const mouseInViewRatio = (clampedX - padL) / plotW;
    const anchorRatio = wStart + mouseInViewRatio * currentSpan;

    // 滚轮向上放大，滚轮向下缩小
    const zoomFactor = e.deltaY < 0 ? 0.75 : 1.333;
    let newSpan = Math.max(0.001, Math.min(1.0, currentSpan * zoomFactor)); // 最小支持放大至 ~25ms

    let newStart = anchorRatio - mouseInViewRatio * newSpan;
    let newEnd = newStart + newSpan;

    if (newStart < 0) {
      newEnd = Math.min(1.0, newEnd - newStart);
      newStart = 0;
    }
    if (newEnd > 1.0) {
      newStart = Math.max(0.0, newStart - (newEnd - 1.0));
      newEnd = 1.0;
    }

    this.curveWindow = [newStart, newEnd];
    this.updateSliderWindowPos();
    this.drawMainChart();
    this.updateStatisticsTable();
  }

  handleChartMouseDown(e) {
    if (!this.curveData || !this.curveData.points) return;
    const canvas = this.container.querySelector('#pzMainCanvas');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const padL = 60, padR = 58;
    const plotW = rect.width - padL - padR;
    if (mouseX < padL || mouseX > rect.width - padR) return;

    const ratioInView = (mouseX - padL) / plotW;
    const [wStart, wEnd] = this.curveWindow;
    const globalRatio = wStart + ratioInView * (wEnd - wStart);

    // 测量功能开启时：优先检测是否点击在 T1 或 T2 测量线上
    if (this.measureEnabled) {
      const pts = this.curveData.points;
      const totalDur = (pts.at(-1)?.t || 1) - (pts[0]?.t || 0);
      const absT1 = (pts[0]?.t || 0) + totalDur * this.t1Ratio;
      const absT2 = (pts[0]?.t || 0) + totalDur * this.t2Ratio;
      const idx0 = Math.max(0, Math.floor(pts.length * wStart));
      const idx1 = Math.min(pts.length - 1, Math.ceil(pts.length * wEnd));
      const slice = pts.slice(idx0, idx1 + 1);
      const t0 = slice[0]?.t || 0;
      const spanT = (slice.at(-1)?.t || 1) - t0 || 1;
      const cx1 = padL + ((absT1 - t0) / spanT) * plotW;
      const cx2 = padL + ((absT2 - t0) / spanT) * plotW;

      // 距离 T1 在 10px 以内 -> 拖拽 T1
      if (Math.abs(mouseX - cx1) <= 10) {
        this.draggingCursor = 't1';
        canvas.style.cursor = 'col-resize';
        e.preventDefault();
        return;
      }
      // 距离 T2 在 10px 以内 -> 拖拽 T2
      if (Math.abs(mouseX - cx2) <= 10) {
        this.draggingCursor = 't2';
        canvas.style.cursor = 'col-resize';
        e.preventDefault();
        return;
      }

      // Shift 点击或右击放置 T2
      if (e.shiftKey || e.button === 2) {
        this.t2Ratio = Math.max(0, Math.min(1, globalRatio));
        this.drawMainChart();
        this.updateStatisticsTable();
        e.preventDefault();
        return;
      }
      // Alt 点击放置 T1
      if (e.altKey) {
        this.t1Ratio = Math.max(0, Math.min(1, globalRatio));
        this.drawMainChart();
        this.updateStatisticsTable();
        e.preventDefault();
        return;
      }
    }

    // 默认进入画布平移拖拽模式 (Pan)
    this.draggingCanvas = true;
    this.dragStartX = mouseX;
    this.dragStartWindow = [...this.curveWindow];
    canvas.style.cursor = 'grabbing';
    e.preventDefault();
  }

  handleChartMouseMove(e) {
    if (!this.curveData || !this.curveData.points) return;
    const canvas = this.container.querySelector('#pzMainCanvas');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const padL = 60, padR = 58;
    const plotW = rect.width - padL - padR;

    // 1. 正在拖拽测量轴 T1 / T2
    if (this.draggingCursor === 't1' || this.draggingCursor === 't2') {
      const clampedX = Math.max(padL, Math.min(rect.width - padR, mouseX));
      const [wStart, wEnd] = this.curveWindow;
      const inViewR = (clampedX - padL) / plotW;
      const globalR = Math.max(0, Math.min(1, wStart + inViewR * (wEnd - wStart)));
      if (this.draggingCursor === 't1') this.t1Ratio = globalR;
      else this.t2Ratio = globalR;
      canvas.style.cursor = 'col-resize';
      this.drawMainChart();
      this.updateStatisticsTable();
      return;
    }

    // 2. 正在拖拽平移画布时间轴 (Pan)
    if (this.draggingCanvas) {
      const deltaX = mouseX - this.dragStartX;
      const span = this.dragStartWindow[1] - this.dragStartWindow[0];
      const deltaR = -(deltaX / plotW) * span;
      let newStart = Math.max(0, Math.min(1 - span, this.dragStartWindow[0] + deltaR));
      let newEnd = newStart + span;
      this.curveWindow = [newStart, newEnd];
      this.updateSliderWindowPos();
      this.drawMainChart();
      this.updateStatisticsTable();
      canvas.style.cursor = 'grabbing';
      return;
    }

    // 3. 鼠标移出波形区域
    if (mouseX < padL || mouseX > rect.width - padR) {
      this.hoverPoint = null;
      this.hoveringCursor = null;
      canvas.style.cursor = 'default';
      this.drawMainChart();
      return;
    }

    const [wStart, wEnd] = this.curveWindow;
    const pts = this.curveData.points;
    const idx0 = Math.max(0, Math.floor(pts.length * wStart));
    const idx1 = Math.min(pts.length - 1, Math.ceil(pts.length * wEnd));
    const slice = pts.slice(idx0, idx1 + 1);
    if (!slice.length) return;

    // 4. 测量开启时检测是否悬停在测量轴线上
    if (this.measureEnabled) {
      const totalDur = (pts.at(-1)?.t || 1) - (pts[0]?.t || 0);
      const absT1 = (pts[0]?.t || 0) + totalDur * this.t1Ratio;
      const absT2 = (pts[0]?.t || 0) + totalDur * this.t2Ratio;
      const t0 = slice[0]?.t || 0;
      const spanT = (slice.at(-1)?.t || 1) - t0 || 1;
      const cx1 = padL + ((absT1 - t0) / spanT) * plotW;
      const cx2 = padL + ((absT2 - t0) / spanT) * plotW;

      if (Math.abs(mouseX - cx1) <= 8) {
        canvas.style.cursor = 'col-resize';
        this.hoveringCursor = 't1';
      } else if (Math.abs(mouseX - cx2) <= 8) {
        canvas.style.cursor = 'col-resize';
        this.hoveringCursor = 't2';
      } else {
        canvas.style.cursor = 'crosshair';
        this.hoveringCursor = null;
      }
    } else {
      canvas.style.cursor = 'crosshair';
      this.hoveringCursor = null;
    }

    // 5. 查找最近的采样点并更新悬停提示
    const t0 = slice[0].t;
    const spanT = (slice.at(-1).t - t0) || 1;
    const targetT = t0 + ((mouseX - padL) / plotW) * spanT;

    let best = slice[0], minDiff = Infinity;
    for (const p of slice) {
      const diff = Math.abs(p.t - targetT);
      if (diff < minDiff) { minDiff = diff; best = p; }
    }
    this.hoverPoint = best;
    this.drawMainChart();
    this.updateHudWithLatest(best);
  }

  // =========================================================================
  // 图1: 坐标轴与通道颜色弹窗
  // =========================================================================

  openSettingsModal() {
    const modal = this.container.querySelector('#pzSettingsModal');
    const tbody = this.container.querySelector('#pzColorTableBody');
    if (!modal || !tbody) return;

    tbody.replaceChildren();
    Object.entries(this.channels).forEach(([key, ch]) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="color:#cbd5e1;font-weight:700;">${ch.label}</td>
        <td>
          <span class="pz-color-swatch" style="background:${ch.color};"></span>
          <span style="color:#94a3b8;font-size:9.5px;">${ch.name}</span>
        </td>
        <td><input type="range" class="pz-slider-input" min="0.2" max="1.0" step="0.1" value="${ch.alpha}" data-ch="${key}" data-prop="alpha" /></td>
        <td><input type="range" class="pz-slider-input" min="1.0" max="3.5" step="0.5" value="${ch.width}" data-ch="${key}" data-prop="width" /></td>
      `;
      tr.querySelectorAll('input').forEach(inp => {
        inp.addEventListener('input', (e) => {
          const k = e.target.dataset.ch;
          const p = e.target.dataset.prop;
          this.channels[k][p] = parseFloat(e.target.value);
          this.drawMainChart();
        });
      });
      tbody.appendChild(tr);
    });

    modal.style.display = 'flex';
  }

  closeSettingsModal() {
    const modal = this.container.querySelector('#pzSettingsModal');
    if (modal) modal.style.display = 'none';
  }

  // =========================================================================
  // 图3: PD 协议分析仪 (PD Protocol Analyzer)
  // =========================================================================

  async openPdViewer(fileName) {
    this.activeFile = fileName;
    this.switchView('pd');
    const lbl = this.container.querySelector('#pzPdFileLabel');
    if (lbl) lbl.textContent = fileName;

    this.pdData = null;
    this.selectedPacketIdx = 0;

    try {
      this.log(`正在解析 PD 抓包: ${fileName} ...`);
      const res = await fetch(`${this.companionBaseUrl}/api/powerz/parse-pd?file=${encodeURIComponent(fileName)}`);
      const json = await res.json();
      if (!res.ok || json.ok === false || !json.data) throw new Error(json.error || '获取 PD 数据失败');

      this.pdData = json.data;
      const countBadge = this.container.querySelector('#pzPdCountBadge');
      if (countBadge) {
        countBadge.textContent = `${this.pdData.totalPackets || 0}/${this.pdData.totalPackets || 0}`;
      }

      this.renderPdTable();
      this.selectPdPacket(0);
      this.drawPdWaveform();
      this.log(`PD 抓包解析成功: ${fileName} (${this.pdData.totalPackets || 0} 报文, ${this.pdData.totalSamples || 0} 电气点)`);
    } catch (err) {
      this.log(`PD 抓包解析失败: ${err.message}`);
    }
  }

  renderPdTable() {
    const tbody = this.container.querySelector('#pzPdTableBody');
    if (!tbody || !this.pdData || !this.pdData.packets) return;
    const pkts = this.pdData.packets;
    tbody.replaceChildren();

    if (!pkts.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="11" class="pz-empty">文件中无 PD 报文</td>`;
      tbody.appendChild(tr);
      return;
    }

    const filter = (this.filterText || '').toLowerCase();
    pkts.forEach((p, idx) => {
      if (filter && !p.msgName.toLowerCase().includes(filter) && !p.note.toLowerCase().includes(filter)) {
        return;
      }

      const tr = document.createElement('tr');
      tr.className = `pz-pd-row ${idx === this.selectedPacketIdx ? 'selected' : ''}`;
      tr.setAttribute('data-pkt-idx', String(idx));

      let badgeClass = 'pz-badge-other';
      const m = p.msgName;
      if (m === 'GoodCRC') badgeClass = 'pz-badge-goodcrc';
      else if (m === 'Accept') badgeClass = 'pz-badge-accept';
      else if (m === 'PS_RDY') badgeClass = 'pz-badge-ps_rdy';
      else if (m === 'Request') badgeClass = 'pz-badge-request';
      else if (m.includes('Source_Cap')) badgeClass = 'pz-badge-source_caps';
      else if (m.includes('Sink_Cap')) badgeClass = 'pz-badge-sink_caps';

      tr.innerHTML = `
        <td style="color:#64748b;">${p.index}</td>
        <td>${p.sop}</td>
        <td class="pz-pd-msg-cell ${badgeClass}">${p.msgName}</td>
        <td>${p.msgId}</td>
        <td style="color:#94a3b8;">${p.direction}</td>
        <td>${p.objCount || ''}</td>
        <td style="color:#94a3b8;">${p.rev}</td>
        <td>${p.elapsed}</td>
        <td>${p.vbus.toFixed(3)}V/${p.ibus.toFixed(3)}A</td>
        <td style="color:#64748b;">${p.dataHex}</td>
        <td style="color:#cbd5e1;max-width:260px;overflow:hidden;text-overflow:ellipsis;">${p.note || ''}</td>
      `;

      tr.addEventListener('click', () => {
        this.selectPdPacket(idx);
      });

      tbody.appendChild(tr);
    });
  }

  selectPdPacket(idx) {
    if (!this.pdData || !this.pdData.packets || !this.pdData.packets[idx]) return;
    this.selectedPacketIdx = idx;
    const p = this.pdData.packets[idx];

    const rows = this.container.querySelectorAll('.pz-pd-row');
    rows.forEach((r) => {
      const isSel = r.getAttribute('data-pkt-idx') === String(idx);
      r.classList.toggle('selected', isSel);
    });

    const setText = (id, txt) => { const el = this.container.querySelector(id); if (el) el.textContent = txt; };
    setText('#pzDetailIdx', `Packet #${p.index} (${p.elapsed})`);
    setText('#pzDetSop', p.sop);
    setText('#pzDetHeader', p.headerHex);
    setText('#pzDetCrc', p.crcHex);

    const f = p.fields || {};
    setText('#pzDetName', p.msgName);
    setText('#pzDetExt', f.extended ?? 0);
    setText('#pzDetObj', f.objects ?? 0);
    setText('#pzDetId', f.msgId ?? 0);
    setText('#pzDetPwr', f.powerRole ?? 0);
    setText('#pzDetRev', f.specRev ?? 0);
    setText('#pzDetData', f.dataRole ?? 0);
    setText('#pzDetType', f.msgType ?? 0);

    const rdoBox = this.container.querySelector('#pzRdoBox');
    if (rdoBox) {
      if (p.dataObjects && p.dataObjects.length > 0) {
        let html = '';
        p.dataObjects.forEach((obj, oi) => {
          if (obj.type === 'RDO') {
            html += `<div><b>[Request RDO]</b> 目标供电档位 Position ${obj.position} · 电压: <b>${obj.voltage.toFixed(2)}V</b> · 电流: <b>${obj.current.toFixed(2)}A</b> (${obj.hex})</div>`;
          } else if (obj.type === 'Fixed') {
            html += `<div><b>[PDO ${obj.pos}] Fixed</b> ${obj.voltage.toFixed(1)}V / ${obj.current.toFixed(2)}A (${obj.power}W) · ${obj.hex}</div>`;
          } else if (obj.type === 'PPS') {
            html += `<div><b>[PDO ${obj.pos}] PPS (Augmented)</b> ${obj.minVoltage.toFixed(1)}V~${obj.maxVoltage.toFixed(1)}V / ${obj.current.toFixed(2)}A (最大 ${obj.power}W) · ${obj.hex}</div>`;
          } else {
            html += `<div><b>[Object ${oi+1}]</b> ${obj.type || 'Data'} ${obj.hex || ''}</div>`;
          }
        });
        rdoBox.innerHTML = html;
      } else {
        rdoBox.innerHTML = `<div><b>[控制报文]</b> ${p.msgName} · 无负载数据对象 · CRC-32 校验匹配</div>`;
      }
    }

    this.drawPdWaveform();
  }

  drawPdWaveform() {
    const canvas = this.container.querySelector('#pzPdWaveformCanvas');
    if (!canvas || !this.pdData || !this.pdData.chart) return;
    const chart = this.pdData.chart;
    if (!chart.length) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;

    // 1. 深色主背景 (与官方保持一致的 #080a0f)
    ctx.fillStyle = '#080a0f';
    ctx.fillRect(0, 0, W, H);

    // 边距: 左侧放电压刻度(52px), 右侧放电流刻度(50px), 顶部裕量(16px), 底部时间轴(24px)
    const padL = 52, padR = 50, padT = 16, padB = 24;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    if (plotW <= 20 || plotH <= 20) return;

    // 2. 统计极值
    let minV = Infinity, maxV = -Infinity;
    let minI = Infinity, maxI = -Infinity;
    for (const c of chart) {
      if (c.vbus < minV) minV = c.vbus; if (c.vbus > maxV) maxV = c.vbus;
      if (c.ibus < minI) minI = c.ibus; if (c.ibus > maxI) maxI = c.ibus;
    }
    if (minV === Infinity) { minV = 0; maxV = 5; }
    if (minI === Infinity) { minI = 0; maxI = 1; }

    // 3. 计算双 Y 轴自适应刻度 (复刻官方 KM003C: VBUS 0..9.000V 步进 1.000V; IBUS 0..1.800A 步进 0.200A)
    const vAxis = PowerzPanel.computeAxisTicks(0, Math.max(1.0, maxV), true, 8);
    const iAxis = PowerzPanel.computeAxisTicks(0, Math.max(0.1, maxI), true, 7);

    const t0 = chart[0].t;
    const t1 = chart.at(-1).t;
    const spanT = t1 - t0 || 1;

    const xCoord = (t) => padL + ((t - t0) / spanT) * plotW;
    const yCoordV = (v) => padT + plotH - ((v - vAxis.start) / (vAxis.end - vAxis.start || 1)) * plotH;
    const yCoordI = (i) => padT + plotH - ((i - iAxis.start) / (iAxis.end - iAxis.start || 1)) * plotH;
    const yCoordCc = (v) => padT + plotH - (Math.min(3.5, Math.max(0, v)) / 3.5) * plotH;

    // 4. 水平网格线与双 Y 轴刻度 (左侧 VBUS 刻度 / 右侧 IBUS 刻度)
    ctx.font = '10px Consolas, monospace';

    // 左 Y 轴刻度 (VBUS: 绿色/浅灰色)
    vAxis.ticks.forEach(tv => {
      const y = Math.round(yCoordV(tv)) + 0.5;
      if (y >= padT - 1 && y <= padT + plotH + 1) {
        // 水平贯穿细网格线
        ctx.strokeStyle = '#151922';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(W - padR, y);
        ctx.stroke();

        // 左侧 Tick 小短线
        ctx.strokeStyle = '#2b3346';
        ctx.beginPath();
        ctx.moveTo(padL - 3, y);
        ctx.lineTo(padL, y);
        ctx.stroke();

        // 左侧刻度数值文本 (如 9.000V, 8.000V, 0.000V)
        ctx.fillStyle = '#8f9bb3';
        ctx.textAlign = 'right';
        ctx.fillText(`${tv.toFixed(3)}V`, padL - 5, y + 3.5);
      }
    });

    // 右 Y 轴刻度 (IBUS: 橙色/浅灰色)
    iAxis.ticks.forEach(ti => {
      const y = Math.round(yCoordI(ti)) + 0.5;
      if (y >= padT - 1 && y <= padT + plotH + 1) {
        // 右侧 Tick 小短线
        ctx.strokeStyle = '#2b3346';
        ctx.beginPath();
        ctx.moveTo(W - padR, y);
        ctx.lineTo(W - padR + 3, y);
        ctx.stroke();

        // 右侧刻度数值文本 (如 1.800A, 1.600A, 0.000A)
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'left';
        ctx.fillText(`${ti.toFixed(3)}A`, W - padR + 5, y + 3.5);
      }
    });

    // 5. 绘制外边界轴线 (左侧、右侧、底部基准线)
    ctx.strokeStyle = '#232938';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, padT + plotH);
    ctx.moveTo(W - padR, padT);
    ctx.lineTo(W - padR, padT + plotH);
    ctx.moveTo(padL, padT + plotH);
    ctx.lineTo(W - padR, padT + plotH);
    ctx.stroke();

    // 6. 绘制 X 轴时间刻度 (Elapsed Time)
    const numTimeTicks = Math.max(3, Math.min(6, Math.floor(plotW / 90)));
    const timeStep = spanT / numTimeTicks;
    for (let i = 0; i <= numTimeTicks; i++) {
      const curT = t0 + timeStep * i;
      const x = Math.round(xCoord(curT)) + 0.5;
      if (x >= padL && x <= W - padR) {
        // 垂直细微虚线网格
        ctx.strokeStyle = '#12151e';
        ctx.beginPath();
        ctx.moveTo(x, padT);
        ctx.lineTo(x, padT + plotH);
        ctx.stroke();

        // 底部 Tick 短线
        ctx.strokeStyle = '#2b3346';
        ctx.beginPath();
        ctx.moveTo(x, padT + plotH);
        ctx.lineTo(x, padT + plotH + 3);
        ctx.stroke();

        // 格式化时间文本 (如 00:00:01.40)
        const totalSec = Math.max(0, curT);
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        const sStr = s < 10 ? '0' + s.toFixed(2) : s.toFixed(2);
        const mStr = m < 10 ? '0' + m : String(m);
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'center';
        ctx.font = '9.5px Consolas, monospace';
        ctx.fillText(`00:${mStr}:${sStr}`, x, padT + plotH + 14);
      }
    }

    // 7. 绘制波形曲线
    // CC1 (蓝色)
    ctx.beginPath();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1;
    chart.forEach((c, idx) => {
      const x = xCoord(c.t), y = yCoordCc(c.cc1);
      if (idx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // CC2 (青色)
    ctx.beginPath();
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 1;
    chart.forEach((c, idx) => {
      const x = xCoord(c.t), y = yCoordCc(c.cc2);
      if (idx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // VBUS (绿色)
    ctx.beginPath();
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1.5;
    chart.forEach((c, idx) => {
      const x = xCoord(c.t), y = yCoordV(c.vbus);
      if (idx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // IBUS (橙色)
    ctx.beginPath();
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 1.5;
    chart.forEach((c, idx) => {
      const x = xCoord(c.t), y = yCoordI(c.ibus);
      if (idx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 8. 绘制当前选中报文的时间同步指示线 (图3 垂直鲜绿色直线与交点圆点)
    const selPkt = this.pdData.packets?.[this.selectedPacketIdx];
    if (selPkt) {
      const pktT = selPkt.elapsedSeconds != null ? selPkt.elapsedSeconds : (selPkt.t != null ? selPkt.t : 0);
      const syncX = Math.round(xCoord(pktT)) + 0.5;
      if (syncX >= padL && syncX <= W - padR) {
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(syncX, padT);
        ctx.lineTo(syncX, padT + plotH);
        ctx.stroke();

        // 找当前时刻对应的采样点画交点圆圈
        let bestPt = chart[0], minD = Infinity;
        for (const c of chart) {
          const d = Math.abs(c.t - pktT);
          if (d < minD) { minD = d; bestPt = c; }
        }
        if (bestPt) {
          // VBUS 绿点
          ctx.fillStyle = '#10b981';
          ctx.beginPath();
          ctx.arc(syncX, yCoordV(bestPt.vbus), 3, 0, Math.PI * 2);
          ctx.fill();

          // IBUS 橙点
          ctx.fillStyle = '#f97316';
          ctx.beginPath();
          ctx.arc(syncX, yCoordI(bestPt.ibus), 3, 0, Math.PI * 2);
          ctx.fill();

          // CC1 蓝点
          if (bestPt.cc1 != null) {
            ctx.fillStyle = '#3b82f6';
            ctx.beginPath();
            ctx.arc(syncX, yCoordCc(bestPt.cc1), 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // 底部报文药丸标签 (如 Accept 0:00:02.579)
        const labelText = `${selPkt.msgName} ${selPkt.elapsed || ''}`.trim();
        ctx.font = 'bold 9.5px Consolas, monospace';
        const txtW = ctx.measureText(labelText).width;
        const boxW = txtW + 8;
        const boxH = 14;
        const boxX = Math.max(padL, Math.min(W - padR - boxW, syncX - boxW / 2));
        const boxY = padT + plotH + 11;

        ctx.fillStyle = '#062817';
        ctx.fillRect(boxX, boxY - 10, boxW, boxH);
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 1;
        ctx.strokeRect(boxX, boxY - 10, boxW, boxH);

        ctx.fillStyle = '#22c55e';
        ctx.textAlign = 'left';
        ctx.fillText(labelText, boxX + 4, boxY);
      }
    }

    // 9. 更新顶部图例常态显数
    this.updatePdWfLegendWithPacket();
  }

  updatePdWfLegendWithPacket() {
    if (!this.pdData || !this.pdData.chart || !this.pdData.chart.length) return;
    const countEl = this.container.querySelector('#pzPdWfCount');
    if (countEl) countEl.textContent = String(this.pdData.chart.length);

    const selPkt = this.pdData.packets?.[this.selectedPacketIdx];
    const targetT = selPkt ? (selPkt.elapsedSeconds != null ? selPkt.elapsedSeconds : (selPkt.t || 0)) : (this.pdData.chart[0].t || 0);

    const chart = this.pdData.chart;
    let best = chart[0], minDiff = Infinity;
    for (const c of chart) {
      const diff = Math.abs(c.t - targetT);
      if (diff < minDiff) { minDiff = diff; best = c; }
    }

    const setText = (id, txt) => { const el = this.container.querySelector(id); if (el) el.textContent = txt; };
    setText('#pzPdWfVbus', best.vbus != null ? best.vbus.toFixed(3) : '--');
    setText('#pzPdWfIbus', best.ibus != null ? best.ibus.toFixed(3) : '--');
    setText('#pzPdWfCc1', best.cc1 != null ? best.cc1.toFixed(3) : '0.000');
    setText('#pzPdWfCc2', best.cc2 != null ? best.cc2.toFixed(3) : '0.000');
  }

  handleWfMouseMove(e) {
    if (!this.pdData || !this.pdData.chart) return;
    const canvas = this.container.querySelector('#pzPdWaveformCanvas');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    const padL = 52, padR = 50;
    const plotW = rect.width - padL - padR;
    if (mouseX < padL || mouseX > rect.width - padR) return;

    const chart = this.pdData.chart;
    const t0 = chart[0].t;
    const spanT = chart.at(-1).t - t0 || 1;
    const targetT = t0 + ((mouseX - padL) / plotW) * spanT;

    let best = chart[0], minDiff = Infinity;
    for (const c of chart) {
      const diff = Math.abs(c.t - targetT);
      if (diff < minDiff) { minDiff = diff; best = c; }
    }

    const setText = (id, txt) => { const el = this.container.querySelector(id); if (el) el.textContent = txt; };
    setText('#pzPdWfVbus', best.vbus.toFixed(3));
    setText('#pzPdWfIbus', best.ibus.toFixed(3));
    setText('#pzPdWfCc1', best.cc1 != null ? best.cc1.toFixed(3) : '0.000');
    setText('#pzPdWfCc2', best.cc2 != null ? best.cc2.toFixed(3) : '0.000');
  }

  handleWfMouseLeave() {
    this.updatePdWfLegendWithPacket();
  }

  handleWfClick(e) {
    if (!this.pdData || !this.pdData.chart || !this.pdData.packets || !this.pdData.packets.length) return;
    const canvas = this.container.querySelector('#pzPdWaveformCanvas');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    const padL = 52, padR = 50;
    const plotW = rect.width - padL - padR;
    if (plotW <= 0) return;

    // 限制在图表有效绘图区间内
    const clampedX = Math.max(padL, Math.min(rect.width - padR, mouseX));
    const chart = this.pdData.chart;
    const t0 = chart[0].t;
    const spanT = chart.at(-1).t - t0 || 1;
    const targetT = t0 + ((clampedX - padL) / plotW) * spanT;

    // 在数据报文中就近查找时间最接近 targetT 的报文
    const pkts = this.pdData.packets;
    let bestIdx = 0;
    let minDiff = Infinity;
    for (let i = 0; i < pkts.length; i++) {
      const p = pkts[i];
      const pt = p.elapsedSeconds != null ? p.elapsedSeconds : (p.t != null ? p.t : 0);
      const diff = Math.abs(pt - targetT);
      if (diff < minDiff) {
        minDiff = diff;
        bestIdx = i;
      }
    }

    // 选中该报文，刷新详细数据与时间指示线
    this.selectPdPacket(bestIdx);

    // 联动定位滚动居中并高亮闪烁
    const targetRow = this.container.querySelector(`.pz-pd-row[data-pkt-idx="${bestIdx}"]`);
    if (targetRow) {
      targetRow.scrollIntoView({ block: 'center', behavior: 'smooth' });
      targetRow.classList.remove('pz-flash');
      void targetRow.offsetWidth;
      targetRow.classList.add('pz-flash');
      setTimeout(() => targetRow.classList.remove('pz-flash'), 1200);
    }
  }

  destroy() {
    this._destroyed = true;
    clearInterval(this._refreshTimer);
    this._refreshTimer = null;
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
    if (this._windowResizeHandler) {
      window.removeEventListener('resize', this._windowResizeHandler);
      this._windowResizeHandler = null;
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PowerzPanel, PZ_OFFICIAL_ICONS };
}
