/* eslint-disable */
module.exports = {
  /**
   * Singleton of PDF vertical settings
   * @type {Object}
   */
  pdfVerticals: Object.freeze({
    pageHeight: 268,
    pageCutoffBuffer: 0,
    headerTitle: {top: 15, height: 6},
    headerSubTitle: {height: 2},
    headerLine: {top: 1, height: 1},
    pageCutBuffer: {height: 8},
    score: {top: 17, height: 23},
    sectionHeader: {height: 8},
    sectionHeaderLine: {top: -6, height: 8},
    sectionEnd: {height: 7},
    itemHeader: {top: 3, height: 4},
    itemNAHeader: {top: 5, height: 10},
    itemBodyImage: {height: 12},
    itemPhoto: {top: 3},
    itemSignature: {top: -2},
    inspectionNoteHeader: {height: 1},
    inspectionNoteHeaderPost: {height: 4},
    inspectionNote: {height: 3},
    itemAdminEditHeader: {top: 6, height: 6},
    itemAdminEdit: {height: 5},
    itemEnd: {height: 10},
    adminSummaryHeader: {top: 20, height: 8},
    adminSummaryLine: {top: -5, height: 7},
    adminSummaryItem: {height: 9}
  }),

  /**
   * Singleton of PDF images
   * @type {Object}
   */
  pdfImages: Object.freeze({
    appIcon: `data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAf/AABEIAMgAyAMBEQACEQEDEQH/xAGiAAABBQEBAQEBAQAAAAAAAAAAAQIDBAUGBwgJCgsQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+gEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoLEQACAQIEBAMEBwUEBAABAncAAQIDEQQFITEGEkFRB2FxEyIygQgUQpGhscEJIzNS8BVictEKFiQ04SXxFxgZGiYnKCkqNTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqCg4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2dri4+Tl5ufo6ery8/T19vf4+fr/2gAMAwEAAhEDEQA/AP7+KACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgDJ1jW9N0Gzkv8AVLlLa1iV3eR2RQFRd7ffZRwoz1rahQq4moqVGLlOTSSV927LZN7+RE6kacXKbslv/TPBZP2sPghFLJC/i2ASRSPE4za8PGxRh/x99mBFfRLg7P2lJYKVpJNP3tn/ANuHmvOcvTaddXTs9unzG/8ADWfwP/6GyH87X/5Lo/1Oz/8A6Apf+Tf/ACAf21l3/P8AX4f5h/w1n8D/APobIfztf/kuj/U7P/8AoCl/5N/8gH9tZd/z/X4f5jJP2t/gZGCzeLoQB15tT/7d0nwfn61eCl/5P/8AIFRzjASdlWTfy/zKh/bE+AoOP+Evi/8AJT/5Nqf9Uc8/6BH/AOT/APyBp/aeD/5+r8P8xP8AhsX4Cf8AQ3xf+Sn/AMm0f6pZ5/0CP/yb/wCQD+08H/z9X9fMP+GxfgJ/0N8X/kp/8m0f6pZ5/wBAj/8AJv8A5AP7Twf/AD9X9fMP+GxfgJ/0N8X/AJKf/JtH+qWef9Aj/wDJv/kA/tPB/wDP1f18y7p37WvwN1S7isrPxbDJcTOkcabrQZZ2CKOLwnliB068dampwpndODnPCSUUm9p7JX09wazHCSaSqrV2Xr959F2l3b31tBd2siywXEUc0ToysGjlQOh+UkcqR3r56cJQlKEk1KLaafdOzO1NSSad00mvnqWakYUAFABQAUAFABQAUAFABQAUAFABQBy/jDxdovgjQNS8Ra9dpZadplnc3tzO+NqQ20RlkY5IGFUZOTXXgsFXx+IpYXDwc6tWcacIrdym7L73oY160KFOVWo1GMIuTb2Sjq/wP4lv+Cxn/BZzUPGWp6r8G/gPr4XS7K7R28R6JeG2vXImWG5gYRvJ8qCF8jOPmYGv7w8EvA2ngaVHPOIMP+9qQa+q16fPBe7zRlrGOr5t/u1P5/454+lXnPAZbUXJF3dWnO0nqk0/JW2/Q/mVk/aE+PMs087fFvxqGuJpZ2H9rSjaZXaQrwOxbH4V/Vi4c4eUYx/sbAWikl+5i9lZbpn5JLNMylJy+u11dt/Ffcb/AMNA/Hj/AKK341/8G8v+FH+rnD3/AEJsB/4Ih/kT/aeZf9B1f/wIP+Ggfjx/0Vvxr/4N5f8ACj/Vzh7/AKE2A/8ABEP8g/tPMv8AoOr/APgRHJ8ffjvIu0/Fvxr/AODaU/07Unw3w80/+EbAa/8ATlfkrFRzXMo/8x2I/wDA7foYN38YvjrOCV+MnjlCRnC6rIOfTkdPz9++eefCfDs/+ZRgk/Kivl1/4J6VDiTM6Vk8TVlZ9Zv/AC/T/gcle/Fz9oqIloPjB47lHbOsS479ttck+EcjXw5Rgpaf8+U/y+5fez2KPFeJkkp4ia0/mf3/AKepzFx8eP2j7Ynzfi346QDPXWJe3/ARXNLhjJYvXKcGvL2S/Nv8j0YZ9XqfDi6rfbmRnt+0b+0Ap2n4w+Oc/wDYYl/+IqP9Xci/6FOC/wDBX/BNlm2NaTWIq2f97/gHb+Cv2i/2hrLVLHV1+L3jh/sV1b3IQ6vLtkNtOswjb5cbX2bT0yDXTS4S4frwnCeU4LlqU5x5nSi0udON7d1dP8zy8xz/AB1JRjDEVedSjK/PZuzTs9PKx/bH/wAEZv8AgtJpvjmz0b4L/HHWbXTtdkkS3tb2+uhc301tZ7rWF8vIh/eq0LnjGSOuef448bvA2pl862eZBRnVw8YtzhTjywUpLna0TWlpW/4e36dwPx3HEqGBzCcYVG9HJ3lZabt9dPXuf1t6ZqVnrGn2WqafKJ7LULeK6tZl6SQTKHjcYJGGUg9TX8dVaU6NSdKouWpTk4Tj2ktGj9kjKM4qcXeMldPumXqzKCgAoAKACgAoAKACgAoAKACgDkvGvjTQfAXh3U/EviK/g0/TNKtJby5uLglY0hhALsxHYZ5rswGBxGY4mlhcNTlVq1pqEYx3cpbJX6mGIxFLDU51as1CEIuTk9kl+P4WP4if+CyX/BZXUfH2rax8FvgfrJh0bT7uRJ/E2g3mP7StLlzBNBIksrjy1S3OcRKcSHqen95+CHghTy6lQz3P6ClWqwTjhcTC6pVILmjJNRWt5d2tFtofz/x5x3LESqZfl87QjKV6tOXxJuzvq+z6a667I/lRvLy91O8n1HU7mW9vrmSSWW5mIMjNK5dskAD7zHtX9fU6dOlCNKlBU6cElGEb8qsraX8kfi8pSnJym3KTbbb31IKsQUAFABQAUAB5GD0oDbVFeS0tZQRJAj57nP8ALpUuEXuk/UuNWcXeMmvQp2vgS3127WC3QRncpYoDkLk5zkN0Az+FYvCwm+kXfSy80/w1+X3G884qYSm5Tblva/e3k11dvT5nos3whudNt1FnJLP8gYhVxyVBwPkHrj8a6IUPZxtG3y/4P9anhriGGIm3VShq1q/N/h9+1+hj6O/jn4ea5aeIvDs9/ourWE0bw39mVSYJHKshQFlYAOYxnjHA5BrHF4OhjaM8Li6UK9CcWpQqawd1a/Ta+3n53PWwmZU4TjVoYjknFprl33V1fb+ux/aZ/wAEZP8Ags/p/iu10b4I/HLVINO1WSa10+w1bWrwyXX2W0It/MjVJtoV/MQkGLsOlfwj44eB1XBTr57kVGVSlGM6tSjQgow56l5Wd4/3XtI/oTgXjqniI08BjZxUm1GNSpLXlWm1/Pe3of1xaRq2n67ptlq+lXKXenahAtzaXMfKTQvna6+xxxX8cVqNTD1Z0asXCpTk4zi94yW6Z+zQnGpGM4O8ZK6fddzRrIoKACgAoAKACgAoAKACgDkvGvjbw74B0DUfEfiXU7TStN021e6uLi7dkiSJGVWZiqsQoLDPFd2X5ficyxNLC4WlOtVrTUIxgk5OTV7K/U58TiaWEo1K1acYQpx5pOV7Wvbofxo/8FbP+CsupfEPU9Z+EHwe1ae30S2uLmxvdd0m7WS01ayuPMRk2tKXEYCgnMSHnvX9/wDgd4GUMuw2HzzP6EKlerThUp4bEQtOhVjazuopN3f8z2P5a8SPEytiK9TLcsqShTpzlGVWlL3akXdbNvbrpF+ujX8qfiLwneXt1Pqkly11eTktK+3Lycs2Dx6k8n1+lf1z9WjSjyUko04/DBa26aPt/Vj8gw2b88rV23KW85PX8Dzi5srm0dlnhePB6sB/Qn0/Lmsmmtz2YVadRXhOMvR/Mq0iwoAKACgAoAKAFVSzKo5LEADuSew96BNpK70SPevh94dFrbpqE6fvJAy4YYI44OQPf1H61rBaX7/1+Z8pm+MdSbowfup3uvXVaPrb/hz1XOOB09Ks8Mp3Gn2V2pW4t0lB67s+mKDSFWpT+CTjbsY1hoMvh/WbbxH4TuhoOu2Rza6jbg+fCSysSuVYdUU/UdDXNisHhsdQnhcXSjWoVFadOXwy0sr+S/I9PCZ3jsFONSnVnzxfutbpev6v9T+wH/gkR/wVYGp2ml/Bz4yayRdI9ppGl6xrd3tVIIRGGkiRJGYod56x546DpX8KeOPgXUwcq+e5FR5qdqletQw9Nu8ndpNyitdFs3uf0v4ceKlPG+yyzNJeyneNOFStPV2+0kpPq9ra/if1O6Xqmn61YWuqaVdRXun3sYmtbqEkxTRkkB0JAJGQR0HSv4wrUauHqzoV4Sp1acuWpTl8UZdnv3P6Hp1KdanGrSkp05q8ZLaS7ov1kWFABQAUAFABQAUAcX488feGvh14e1DxL4o1Sy0vTdOgNxPPezCGJYxwSzkHAz3ruy/LsVmeJp4XCUZ1qtSSjGMFd3e2hz4nE0sLSlVrTjCEVdyk7JLzZ/Dp/wAFh/8Agsn4h+Iuuat8G/gtrd5puh2Nzd6Prl/ZXJuLHWbOVZnXYyyIPL3GE8qfuDvX99eCfghh8roUM9zyhCpiZxhXw8Jx5alCa5U+m9ubru0fz3x3x3Uxc55dgpyjSTlCrKLvGcXd+Xlr5WP5stA8ZXM85OsTNcXUuBJcMcBiec8k8ZJ6V/X9KcacVSS5YR+FdFt/l+u7sfgGYZd7RyrQtzN3lZa/8Nfu3oeoxSpMgkidXVh1U54xn8v84rp31R85KLjJxkmmu+hl6hollqKsJolLsD85+nH5HH/66mUVLdG9HF1qDThJpLotP66/f2PMtZ8G3FruktiGTPCRruI5+n5deOlc8qTWqa9NfzPoMLmlOpaNRNPq2/6vr5rY4iaCaBissboRnlhgfrWJ60ZRmrxkpel/8iKgYUAFABQB2Pg/QpNWv0ZlzFEUkyRwQDzg+vT2561UVdrR2PNzHFxw9FpNc0rx03XX+rH0xbwJbxJFGoVVA4HTOAD/ACrY+KlJzk5S3be++5PQIKACgDR0XWtW8Nataa9oN01jq9g/mWl0md0b8HIwQc8due45rLE4bD4zD1MLiqaq0KqtOD2a7PfT/g9y6VWphqsa9CThVg7xkt0z+tT/AIJP/wDBWpNah034Q/GDVJnuYBaaLpGpapdeTbx/6qV5Y1Z3ymWlGBjHJHHFfwr44+BTw0q2f5DRioT9piMRRow5pvWUUpWS12euux/UHhj4oKtGllWa1XzR5KNKpUlypbN/m73+R/UlpWrabrlhBqek3kF/YXSb4Lq3ffDKv95G4yPfFfxXXoVsNVlRr05UqsHacJq0ovs0f0jSq060I1KU4zhJXjKLumvJ9fM0ayNAoAKACgAoA4T4hfEbwr8MvDt94m8WatYaVpunx+bPLfXcNoiphjkySkKBhTz613Zfl2KzPEQw2EpTq1aj5YqEZTd9NLRu+qMq1anQg51JKKSvq7fjsfwr/wDBXv8A4LR6v8ZNa174KfBbWrzT/DlhLe6B4kfzZLq01Vf3kiSWs8Jt02YmhAP70fKcH0/vvwQ8FcJlVGjnudUKdXFNU8RhUrKVJ6JqcXzO7s+2n4fz94g8Y4mrJ4HBzlCk+anUerUlq7pq2m2+nVXP5jJZri6nlvLuRprqdt00hJO5uOeST2Hev62jGMIqEFywirRjpovkkfi0pOTcpO7e78/xGgkEEHBByD7/ANaYjuPDfiqaxdbe5ZniwFUAHAJ4znnjpnj/AOtrTqcuj2/r+v608nHZdCsnOkkp6vp09NU356Hr9rdw3kSywspUgcBgx6e1dSaauj5mrSlSk4yT062sWTyMHkelMz21Rz+qeHNP1FTuiHmn+Ilcd854Hfp+dRKnF9Nf6/rSx3YbH1aD+JuPzv8An6/p2PLdW8J3enlnQB48kgIu4j8j6e2cfrzzpta9P62/y/M+hw2Y0q9lJtS2u/60+WhyjxvGSroyEHGGBH86yPQTTV0015DKBk9tbyXVxDBGpJkcKcDOM+vsaCZzjThKctor+v6/pfTfhDQ00nTYdygTldrkYHYduo5z+tbpJI+IzDFPE1pNP3E04rXR/wBeX3nXUzgCgAoAKACgDQ0bV9T8O6tZa9otw1pqumyiezuFLfu5QCAxCsmeCf4h+fNZYjD0cXQqYXEQU6FaLjUj1a7a3XpdOxdGrUw9WNei+SrB80Za728mj+sb/gk9/wAFahfwaX8HvjHqs9xPbxWuk6ReXM5tLSK4kMZMm6fzlZMB8/OPrX8N+OXgU6Uq+f8AD+HjCMnOviKcI+0m4x5rRtHlae1tH5o/p3wy8UFONPKs2qtyXJSpTk+WKk7a+9dWtfS67pn9UOlavput2UWoaTe22oWU4zFdWkyTwyDg5SRCVI5HSv4lrUK2GqSpV6c6VSPxQqRcZL1Ts0f0pSq060FUpzjOD2lFqS+TWho1kaBQAUAc34s8Taf4Q0K917VG2WdlG7yNuC/djeTqcjohrowuGqYutChS1nN2XzaX6kVKipxc5bLfp0b/AEP8+3/gth/wWi8S/GDxF4l+A/wi1e+07w1ZyX/h/wATLNHcQyS3dsXjBt7hFt8JiT7wLA9QcV/eng14O4bKcPhs8zalCpiZqniMNZxaUZJfFG8ru8fLc/HeKeKZ15TwtCUo003Gd7pu38rtt/Xmfy9aDrd22qyXV/cSz3N/OJLiSWR5Wd8KNxeRmJPHqfx5r+qsI40XGnBKMNEktFbtpt3PyTNaTxNNzavKK769f68tD2FXEiiReVfJBr2U7pM+QaabT3W46mIM45HBoA6fQvEc+lSqruxhyFwNxIycHnPTn2/WrhNxfl/V/wDM4MZgY4mLcUlO3orJfn9/c9p0/UrfUYVmhYcgAqWG7OOeOCBn2rrjJSV193Y+UrUJ0JOM093008tfM0KoxGsiuCrAEH1AP8xQNNp3T/P9DldV8JWWoBnij2ykeqqMn8uP84HWs5Uoy9f6/rqelhsyrUWlJ3in5/1vqeW6r4bvtNYkpvTPAjUucDt8pPp6YB446VzShKPT/hj6DDY+jXW9pNdXbX5/8Nqd18P/AA080n266iZVAWSPehQgjH94c9vftiiEbu/b8/8AL+u55mb43lj7GnLXZ9d9/T+u57pjHA4Fany/ruFABQAUAFABQAUAaGkavqXh/VLHW9HupbTUdNnW5tZY5ZIgJUBAL+WyEgBjnmsq9Cji6NTDYiEalGrHkmpJP3dNFdSS27F06tShUhWpScZ03zRs2tVtez9T+qn/AIJPf8Fc4QNF+C3xj1aW5nhhtdO0uUExq19c7YgWnnWXzADHk4kz74NfxB46eBkYuvxFkFGMYylUqVo3Upeyhd25ItWevb8j+m/C3xLqVFTynNJyfJCMacnFxTm7JXk91dd/zP6wNM1K11aygv7KWOa3uEWSN43WRSGVXHzISpOGFfw/VpTo1JU6icZRbTTTT0bWzSfQ/peE41IqcXeLSaas07q+jRfrMsKAPl/9sNnX4C+MDHI8beSQHjdkYf6JedGUg/rX0vCVnnmEuk1fZ6r44HBmX+51fT9Gf5Dv7R7O/wC0F8YWkkkkP/Cc6xzI7O3EqnqxJ71/rDw4kshylJJf7FS2SXdbI/nDNW3ja6fSpL9DxtHMbrIOqZI6/wBK9tOzueXKKknF7M9s8NagL2yRGYb4Y+ee/Hr9f046GvXw9RTgl1S1/rbT+kfIY+h7KtJ9JPT+vSz+Z0VdBwBQAUAbOk61c6XMrRudgIyGJIwTzwc/n+lVGbi9DmxOFp4iLUl73kkv6/roe16PrdtqsKsjjzMAEEgc4wePY/p1rrhNTV0fKYrCTw8rNe7a/XT5v5fgblWcYUAdN4T8NHxRq1tZmESQ+eqTkpnC4JznB9QP/wBVY16ip05N720Xn/X3mdau8NTc1Jp8t0k2t9PL+tj6jvfgtpkWmxw6bGVuYkORkICcYAOCMjvz27V5UcW1Jt6J9l8/TTb+rHgLNKsqjlVbab9X/W3n69fDtd8H6xoMrLcwkxqcZjVn6d8gH27+/Su6nWhUSs7NrroenSxFOslyvW17PQ5fnuCPYjBrU6AoAKACgAoAjlljhUvIwUD1IB/DJFA0nJ2Su38zi9X8VxQborZst905APPsccdPeoc10/r+v17npYbL5VPeqbaPTX+vP19S/wDBLVtRb44/C2eK8ubWRvGejlja3EsBbE44YxOmR14OR/Tw+IoRq5BnCqRjNLAV7cyUre7a6TTSfna59Rk0I0MxwPs7x/2mndp2ej8t0kvXof6kX7KNxPdfBPwrNcSSSytAm55HaRj/AKLa9Wclj17mv8gOM4RhxBjIwSjFS0UUkvjnrp3P7lyJt5bh3JtvlWru/sx7/cfR9fKnsBQB8vfti/8AJBPF/wD1y/8AbS9r6XhL/keYT1/9ugcGZ/7nV9P8z/Id/aN/5OA+MP8A2POsf+jEr/WLh3/kRZT/ANgVL9T+b81/37Ef9fZfoeNV7J5x1PhbUjZ3gjZsLM4Xr24/LkY7AfrXRhp8k0r2Uv6/pdTy8zw/tqfMlrFN6L1/4O/lY9mDq/zL0PT/AD79a9g+UacXZi0CCgAoAv6fqNxp0yywu3B+6WO3k5PA/wAKcW47N/1+vnuY1qNOvBxmlqlrZX0PZ9B8R2+pxpG7gTjauOAM9+eM8/4V1wqKWnX+v67Hy+NwFShJtL3LN/r59P06s6xI3mZYohud+FA7+vrWm2rPOvyu76f0vxsfaHwg8Fx6Npo1K5i/fXkSSJvUNtYFehPI+6eQP0rxMXX9pPlT0j2ej3+//gHzOY4n2s/Zp+7B9H+fff8AI9vJJJPrXEeYUbzTbLUImhuYInDKy7zGrMM98kZyPX6U1Jxd07Wfy+4qMpRd4to8S8V/CGC48y50nzHkOTs5RRjnOAxH145rtpYtrSW3S/49tEeph8wkrRqWtsnv/X379jwTV/D+qaLK0d9Bs2k8rubvgfwjg/z4rvhUjU+F/eerTrU6vwO5iVZqFAGHqWuWlgpBkHmDoMZGcH3/AKHqKmUlH1sb0cNVrvSPudXdp2+719fz8z1TxBdXzFQ22MngqSOCOvH+J69qzlK+lj3cPgqdFXesl3V9b6f0zAJJ6kk+pOTUnZ6aHpvwP/5LX8LP+xy0j/0oFeVn3/Ihzn/sArf+kndln/IxwX/YRD8mf6lv7JX/ACQ/wn/1wT/0ktK/x/40/wCShxnr/wC3zP7iyH/kV4b/AA/oj6Vr5Q9gKAPl79sX/kgni/8A65f+2l7X0vCX/I8wnr/7dA4Mz/3Or6f5n+Q7+0b/AMnAfGH/ALHnWP8A0Ylf6xcO/wDIiyn/ALAqX6n835r/AL9iP+vsv0PGq9k84fFIYpElBIKHcMeuO/8A+uhaardEzjzxcXs1Y9s8O6gL2xiBOZFXLDqRwO/XH4dfzr2MNPngk90vz+R8hj6Hsq03ayb0v1+X9aHQ10HAFABQAUAWLa6mtJBLC7KRzgHAP1/z/wDWadncidONSLjJJp9Wtv6ufWXwKltvEmsWo1Iqotp1jx94PnbywJHr09R1zwXWrT9lJJa23v8A5v8Ar8T4nP6DwkZOld86b7dGrffb5v7/ANIbeGK3toIYFAhjTEeBgbcnt2/XNeLu23u9/wCv67dD4Ftybb1bd2S0CCgA7Y7enagDH1PQdN1eNorm2hy4Pz+WC2cccn39fwq41JRejfpc0hVnBrlk7K2l9NPyPnrxx8MItMSW+s5JGABbZjauWG7tnoenP49RXdRxTdotfrov6X/B6+vhcdKo1CSV76vyS6dvmfJ/iXXLqykktVQLtLLuBw2VPPH+TXW53WnX+tH5n1eDwcJ2nNvulbTXr3/qyPOpriW4YvI7NnnBOetZ7nsxjGC5YpJLTT+upDQMKAPTvgf/AMlr+Fn/AGOWkf8ApQK8rPv+RDnP/YBW/wDSTuyz/kY4L/sIh+TP9S39kr/kh/hP/rgn/pJaV/j/AMaf8lDjPX/2+Z/cWQ/8ivDf4f0R9K18oewFAHy9+2L/AMkE8X/9cv8A20va+l4S/wCR5hPX/wBugcGZ/wC51fT/ADP8h39o3/k4D4w/9jzrH/oxK/1i4d/5EWU/9gVL9T+b81/37Ef9fZfoeNV7J5wUAdd4V1M2l15TthZNqDJx19P89vxPVhqnJOz6/wDDL+tTysyw/tafMlrG8npfbX1/q3kewghhlTkHvXrHyrTW4tAgoAKALdlZy31zHbRAl5M4x17dPf8AwoM6tSNKnKpJpKPc+pvCOntoFnbyWrGG4MaszJw4cHuemeB6Y7Vsoq1nZ9z4XHV3iqs+azgpNJdLf15n1Z4A+JgZY9N1VlVsLFHLI2Wc9dw56jnP+TXBXw1ryhtvtttv1/r5HzmLwNrzp36uyW3r1+Z79DNFcRrNC4eNxlXHQiuDbRnkNNOz0aJaAGuwRSzHCgEknpx1oA4TxD44sNLR47d47iYcbc4I7evY/gMGt6dGU99F/W/9fiddHCTqWbvFf1+fl+eh4brPiTUNXkcyTSpESf3W4FcZ49e3HPNdsKUYLZX7/wBbnr0qMKS0im+/9a9F1t5HA6p4e0/U0ZZIY0kb/lptJPOcnvyT7f8A1tDvo4qpSatJtdv8u3n/AFfx/XvAF3ZlprISTpydqrwOv5/n/LgPaw2Y05pRqNRa6vd/j/Xnoec3EE1q5jnQxsDjB9f6UHqQlGorwd/w/UioGenfA/8A5LX8LP8AsctI/wDSgV5Wff8AIhzn/sArf+kndln/ACMcF/2EQ/Jn+pb+yV/yQ/wn/wBcE/8ASS0r/H/jT/kocZ6/+3zP7iyH/kV4b/D+iPpWvlD2AoA+Xv2xf+SCeL/+uX/tpe19Lwl/yPMJ6/8At0DgzP8A3Or6f5n+Q7+0b/ycB8Yf+x51j/0Ylf6xcO/8iLKf+wKl+p/N+a/79iP+vsv0PGq9k84KAJIpDFLHIOqMG/KmnZp9mTOPNCUe6se3eHr9b2wiJIMnJb1HA647D+npmvXw9Tnh5/1+p8djaDpVpK1o9NPN/d/w/kjeroOIKAD/ABA/M4oA9m+Hfh0kjUbmMgxuGQMOqtg8HHHTqfp61pBde35nzecYz/lxB3Tunrt+v9eh7SAAAAMAdBWh82PR3jZXjYo6nKsOqn1FAPXR7M9r8A/EqawePT9TZpIiVjSSVsKoJGWUAjp9DXFXwyleUVsm/PTp10/I8vF4KMvfgrPdpf1t+R9BT+KdGitftaXkEoIJVQWweAcDIHPPr+Veeqcm7Ws/6/r+keRGhVc+Vxa21fTffX+tTxvxJ4/ur55ILLzII8kb0III9OWPBHsPxFddKglaUtdNv8/w+X3nq4fBRirzabtfXT8O66b/AHs84llknYvM5kc9S31z9K6UktFojtSS0WiI6YwoACAw2t8ynqpPBHpQByuseEtN1RHxFFDKQSJMEtuPfv0/yKDtoY2pR6yautE7aJW/z+9/LxjW/BN/pzM8CyXEYJ+6oCgD14H+cUHt4fHwqLlnZPa73vt0/rTbvtfBOOSL42/CxZUMbf8ACZaQCrdQftA4ryc/dshzi/8A0AVv/SWe7lTUsxwPK074iFrfNH+pV+yV/wAkP8J/9cE/9JLSv8gONP8AkocZ6/8At8z+48h/5FeG/wAP6I+la+UPYCgD5e/bF/5IJ4v/AOuX/tpe19Lwl/yPMJ6/+3QODM/9zq+n+Z/kO/tG/wDJwHxh/wCx51j/ANGJX+sXDv8AyIsp/wCwKl+p/N+a/wC/Yj/r7L9DxqvZPOCgAoA7HwnqZtbryXJCMoRRnjJBA/HpXXhavJOzejVkr2/r+rHkZphlUpqavzJ3fpv629D14EEAjkEA/nXqnyzVm12dhaAOh8N6PJq+oxQhSYifmbGVBBHX368e3NNbr1OPG4mOHoyldKXRdbf5fj8j6h06yjsLWK3jULtjVWx3IH0H/wCutz4erUdWpKbvq3a/YvUGZHJLHEu6R1QYzkmgaUm0oxcn5f11ON1fxTHb5jtvmkUna6nv/h0/X0qXNLRa99dD0cNgJT96pouz67dupX0P4h6rDMkF/cSzWpYKsbdEzwT16dPpWFldvy+X+Z1YjK6Li3TjFS3urXfzt/l8z23TtStdSgWW3kRtwzsU5I4yT/j/AJwzwKtKVKTjJNW7mjQZBQAUAFABQAySNJVKSLuU8EH09KBqTi7o0/hf4L0+8+MnwxuIY44XTxhpTknGTtmyB09eeuO+K8jiFtZDm9v+gGt5/ZfQ97JMdUhmmXRk24vFUk/nLd9/u+Z/pWfsq2/2X4L+F4c7tsKc/wDbraj0HpX+QPGn/JQYz1/9vmf6DcPS58qw8u6/9tifRlfKHthQB8vfti/8kE8X/wDXL/20va+l4S/5HmE9f/boHBmf+51fT/M/yHf2jf8Ak4D4w/8AY86x/wCjEr/WLh3/AJEWU/8AYFS/U/m/Nf8AfsR/19l+h41XsnnBQAUASwyGKWOQHG11J+gINNOzT7O5E4qUZJ9Ytferf0j2/QdQW+sY3zl84PPoPT3/ABr2aE+eCd7v/hu/9fgfH46g6NaStp+G/Q3443ldY0BLMygADJ5IH9a2OFtRTb2SfW3Q+jfA3h9dLslmkQCZiJFOMYDDd7n09OPrW0VZdL/ofGZpi3iK3LFvkSa0va6f3d/uPQM45PAqjyzF1LWrWwjJLB2x0VuR+GD/AJ6ZpOSXX5HRRw1Ss1ZNJ91/Xou/noeaap4iu75iscjLFn7rZ+6c8Z47+1ZOTfp2Pcw+Cp0knJKUrdNrrv1OcPJJPJPU1J2eXQKAOn8PeJbzRZ02yN5GQpRc5AOQeh6EHr2oOTE4SFdPRc3d9/6+/qfQmi67Z6xbpJFIquQAUZhuyBycYB5xxxQfNV8NOjJpp279LdNdf61N2g5woAKACgBCQBkkADqT0FAG/wDDPxTp2l/GD4Yws6SyyeMNLj2o4JBM2ASMHA549favI4h/5EGcf9gNb7+V2PcyLCVKua5fpZLFUm76Lfa/f9Nj/Se/ZVuBdfBfwvMBgNCuB/262tf5A8af8lBjPX/2+Z/oTw9HlyrDry/9tifRlfKHthQB8vfti/8AJBPF/wD1y/8AbS9r6XhL/keYT1/9ugcGZ/7nV9P8z/Id/aN/5OA+MP8A2POsf+jEr/WLh3/kRZT/ANgVL9T+b81/37Ef9fZfoeNV7J5wUAFABQB2vhHVPs119ndiEK4AJP3myBg/4c8d668LU5ZWb0t5/wDDb2PIzTDe0p86+K/Ra208vK1/+CfT/gPw+dSu47uVMwAZGeOR8w68Hp29+ea9iCvrpb7/AD/r9T89zbGKhTlTi/f62fR+m2l/60PoGSe3soVDuqrGoULuAOFGOnXt6c1qfJqM6knyq7bvs7X/AK6HCav4szvitCynBHcrkcdQB+vB7c1m59vy/r8j1cNl206tu9tL+ln+Ohwc9xNcOXlcsSfU4/LP1/n1rM9aMIwVoqy6/eQ0FBQAUAFAGxpGtXej3CywSELkAjk8E89x2oMa1CNeLi1rZvp+tj6D8OeKbTWoEXftmACnzGC8gYPDYOCeR/M9KD5rE4OdCT0012u1/wADyOtoOIKAK9xdQWsbSzSIiqMnc6qSPbJ/ofpQVGEptJJu/ZNnjfiv4kpF5lnpjMH5RmwWU9cHIGPTnJFL+v8Ahv68/X28JljbU6i03SvZ7bdr/p8zB+DGoXWo/HP4VzXUhd28Z6OTgsBn7QOgya8niFf8IGc+WArfkfV5VThTzDARgrL6xD13R/qd/sj/APJDfCf/AFwT/wBJbSv8geNP+Shxnr/7fM/t/IP+RZh/T/22J9L18oeyFAHy9+2L/wAkE8Yd/wByf/SS9r6bhFXz3Ca213/7egcGZ/7nV9P8z/Id/aN/5OB+MP8A2POsf+jEr/WHh3/kRZT/ANgVL9T+b80/33Eb/wAWW/yPGq9k84KACgAoAvacHN5b7O00TPzj5BIuf0zx/wDWq4JuSSvv/XyOfEuKozv/ACySXyPu7wf4k02z8PRrAQbgBQcBSc7OemTjP4D8a9+nJKC72Xn07/L1PyDMcFWq4yXNflbbvfpfz62fluU9S1m61ByXfCc4AyO/Hp2pNt7/ANf1/W5tRw1OitFrpv8Aj+PqY5JPUk/WkdIUAFABQAUAFABQBdsNQudOmWe3dgynoWbGMgnjP+fzoIqU41VyzSt5Lyf+Z734V8YwapGlvcOFuBhQWwq8deTjv+HH1ovb+v1PnMXgZUm5RV46u39b/Lrp1NnXPFOnaLAzyTKz7dy7GV+n0z/n6g0GGHwlSvKyi7ed0fPXiXxxf607xJJttwWC7cqdpzjpjnnP0pJt39fTov8Ag6n0mGwFOik2lzaN9df+G08tjhCSxJYkk9SSSf1pnonp/wAC8/8AC7vhVgMx/wCEz0fhQWP+vHYV5HEP/Igznb/cK27S6eZ2Zb/yMsD/ANhEPzR/qk/sj5/4Ub4S3KyHyEyrAqR/olp2PNf5A8af8lBjLWevTX7cz+28h/5FlD0/9tifS9fKHshQB518VfAlp8SPBGseEr1pFg1KF1YxEq+7yZoxgqykf60969DK8dPLsbSxcLc1NrdXVrp9n2Ma9JV6Uqb2kf5iP/BXD/gmN8Vf2Tvi/wCLfHR0O6l8I+KtV1TxE96Xurplt5XLRkfLKqZCn5d69DX+k/hR4k5XxRlWFwPtorF4WlToeztGPvRVmm7rq77d12PwriXIMRhMRUq8jUZSlNbu6fey02vt89j8SQc9ip7qwKsPYqeQfY1+0/NPzR8W002nuhaBBQBFJMkQ+Y+w+v8Ak1nOpGC1e+22/wDX9dC4QlN6dN2amlu23zgBggjOBn2PTg8/57dWFbkufo9Nunlq/wCvkcmLiruF+3X/AIb0tp8z1nwLrbwXa2k0h8tsnBYkcnj73b/PoK9Ck/eSffS/f/h9fx9Pmc2wilTdSCV/Ra29O+nTp1Pb1O5VYdGUMPoa6j5V6NrsxaACgAoAKACgAoAKAI5JUhUvIwVR7gH9f88HmjbVjjFyaSV2ziNV8btp7ldNlPnLnAyV5HuOc4+o6E4FclWukmo7/wBa/wBb+h62Gyv2qTrL3e+9r+X/AA1/IqWPjO51Zwmozvv3YVd7MD6ggkD1/P16FGtd2lp/X9f1ZOq+VxoLmoxVt3davd6f1bz7dKCGAZTkNyOc1176o87VNp7rfSwqq8jrDCjSTSELHGil2Zj0AVQSTjJwAfpSbUU5SaSSu23ZJebDqkrtvayuf0H/APBIz/glB4y/aA8Y+HPi3490q9sPCGmXGn6/odxC9zBJLNbOJmWeJvIG3a6cEuMkjGK/mrxo8Y8Dw3gcVk2XVqdTHVo1MNiIyUJKMZpxvGXvO909VbY/VeA+BcRmtejj8VTlChFxrU2nLVre6fKrax7r7j+/bwV4S0/wT4c0/wAO6Zu+yWEMcabhhvlijjORlv7g71/nDj8ZUx+JqYqrbnqNt2/xNrou9j+pMNQhhqMKUL8sUrX9Ev0OrrjNwoAKAPmX9p79ln4aftR/DvW/AXjvR7CZNXtTajVHsIbq+tIysin7O7lWXO/+Fh0r6ThribMeGcwo47BVaidKfP7JVJRhJ3T95LfY4cdgKOOoypVEtVa9k2tOnb0vb0P82L/gq3/wSh+Jn7F3xD1fxHpOg383w+1m/vNQs9QuROqx6bErRq8UXlPGo3wN8qyY6/NX+ifhb4pZdxhgKOHq16azClCFOcIuPvVG02m3JO9pb28mj8R4j4crZfVlUjB+zk5OLu9VbqrPqtNddD8Sw6lN4+7jPPH51+0Npbnxlne1texnXOoxplYyGOOQc9/f29Oc81yVcUo/DZ9tV+ev/A/PqpYWUrOSst/+H/4HQpWUct/cjdnaCGPOQOT27DA69/xrGhGeIq6t8qadl2v/AMH5ardHRXlDDUdErtNLTy0/P+unfRxrEgRegA/l/nnv1r6CEVCKikv+D/wT52UnNuT3bf5lu0uHtbiOZCQwZBwccbgetWnZ3MqsFUhKL2s/yZ9K6BqSalYJKpyY1jQ4x1CkH9VP+c12wd4o+GxlB0K0otW5nJrp1/r7+pt1RyBQAUAFABQAdaAMnUtYtdMjLTSBXAOAQCOn19/TFRKpGCu2dNDC1a7ShG67/wBf10PKdZ8T3OoOyREJHkjKNg8HA6YwSOvt1NcNStKTstFtddf61/qx9BhsDChFOWst7NX37Ptpv93U5QszElmLEkkk+9YHfpskkl2FVmQhlJUjoRQFr6PVHZ6H4hYSR2UvzSSYSLPzFsc8enQn8666Vdpe9st3+vr/AFqeTjMDze/ST5tXZfgrL1/yP6WP+CSP/BJLxX+0R4j0X4rfEjR76x8FWU1nrWjSokk1tqcHyI63EUiRRmP96cjc4O3tya/nTxl8Z8Dw3g6+U5VXp1cdVU6FdNqMqUtbOEk5O+nZdmff8C8BYjM61PG46nKFCm4zhu4zWzuvd01fVvTTqf3nfCv4TeD/AIQeFtP8KeENJsdOsNPj8qI2lpFall2quCsYwBhBxmv87c4znHZ3jKmMxtapVqVJcz55ueuut3113ep/TWCwOHwFCFChThCMFZcsVH8vu+R6bXknaFABQAUAFAHzZ+01+zF8Ov2nPh5rngbxxomm3rapp8lhband2v2i409ZGLF7fJwpyzdu5r6HhziTMOG8woY3BVqkFSqKpKlCVo1GtPe0/I4sdgaOOozpVYRfMrKTV2j/ADTP+CuH/BKD4ofsafETWPEvh3Q9Uvvh5q+qXUtnqDxGC0g0+FJiZYlESgLuhAxuPJI7cf6B+G3irgeLsBSw1etCnjadOMZwUuaTm2r3d33+ep+SZzwy8FUnOMG4yb5Xa2n3beSfn1Vvwlhb7SVKEtuIA/H+h9fz5r9eScpKOt27a/1ufLzXs781lyq78vwPQdIshawKWH7wgg56jPr3/wA819Hg6HsqUXbV6N2/Xt8u583ja7rVXZ+4tlf/AIH4dF2Neus4woA9L8AawYJ1sZX4kYtyc98flg1tSnZ2e39fr67ng5xheeHtYrWKta2/z0069vyPbAQQCOhGR9K6j5VqzsLQAUAFADJHWNC7nCgZJoHFOTSW72OJ1vxbDah4bYpI/I6888Z79PT17VzVMQkmo6v+v6v9x6uFy6U2pVLxWn5a9P679Dy281C5vZGeaR2BJwpOQOc1xSk5O7Pep0oUo8sUvW2u39X/AMilUmgUAN+ZmWKJd8z/AHE7saNEuaWiW7Gk5OyP6VP+CO3/AARx8Y/H/wAWaL8W/iro2oaT4P0u8tNW0qK4tzPYa3YyLFG3mgxD5N0kvRhzH1NfzX4x+MmDyDC1spymvCrjKlOdKq4S5alCpFtq1tm0o/Jn6ZwhwdUx1SGKxcHGinGcVL4akdN0+l9flY/0B/hP8JvCHwe8JaX4R8IaRY6XYaXbC2jFlB5CtGuMDbk8DAr+AM3zjG5zi6uLxtepWqVJubdSXM0352P3jCYOhgqUaVGnGEYrlXKraHp9eUdYUAFABQAUAFABQB85ftL/ALM/w3/ac+HOveBPHnh/S9UbU9LmsNP1DUIpJW0t5pFdp4VRsbsbxgo/3zxXu5Bn+P4fx9DGYOvUpqnVVSpTg0vaJK1nf5dVsc2KwtLFUpU6kU7qyb+z5o/zZf8Agqt/wSC+IX7G/wATte8UeFdI1PW/h7d6lImn3NvaJDp1tawtMXliPkwOVVduclsenXH+hnhF4lZdxbg6OHxlalRx0IRcoSk3UlJpWT1ku/3n4vxdk1fBXdGEnTk2uZJba90vJd+vU/FxWVh8uODggdiOCPzr+iLW06dO39dz8w1679R1IAoAt2N01ncx3CEgqQOMdyPWmnZ3MqtNVYODSafc+lNC1BNQsYnVgxSNFbBzzjofQ12wlzRT1+a/r+tT4bF0XRqyTVrydtvw/rsbNUcoUAZt/qlrYRlpZUDD+FsjJHbjn8v04NTKcYK7fTbub0aFStK0Yt+fbzPLNb8VXF67R25MKZPKngg9up46e3864atdybUdF/X9X669D38LgIUUnNKUvPv+D/H/AIHHMzOdzsWY55PXrn/Pr1rnPS0SslZaaeg2gAoAFWWWRYbdDLO5wkS/ebkDjkdyO9DcYrmk7RW77f0vu3HGLk7JXbP6Y/8Agjj/AMEbfFXx38WaN8Wfi9o95pfhDS762urfSNXs0lsdcsJ/LIcNHC7+X98f62Pv3FfzN4x+MuFyLCVsqyitCpi6tOcZVqM2qlCor6WbV3tun+J+ncH8HVcZWp4rFxlGlFpqE0uWaduurSfrc/v6+FXwq8IfCHwjpHhDwfo1jpGn6TYpZRx2KOkbRxuzqAHZiACeOnSv4CzXNcZm+MrYzGVqlapVm5t1Gm02tdtD94wuFpYSlGlRioRirJR2t/X9bt+l15p0hQAUAFABQAUAFABQAUAfPv7Rv7Onw/8A2kvh9rPgfx1oljqsd7p11aafLeqWSymuAB5wAVjkY7An0FfQcO8RZhw3mFHHYCvOk4VIzqKD1mo9N0cWPwNDH0J0a0IyvFqLf2W+v9d2f5xf/BWX/gkn8Qv2PPiFrnibwZo97rfw+uL7yLM6TYhLC3RZpGmlDukJ2pHJGTx0XOK/0b8JfFzLuMMvoYTHVqdDHxp80/a1P3knyqysr9U7aW1+S/BeKOFq2W1p1aUXKjzWXKrRSv3stv8ALyPwt5BZSMMjMjqequpKsp9wQRX7r6appNPyauvwPhnpo90FABQB6j4A1nyphZSvgSSDAJAGAcfUZz1/Pit6U7af57f8Dt93U+fzjDXj7WK+FO+nlf8Arf8ANHsrOirvZgqf3j0A/rXSfMKLbtbXscfrXiq3s1eKDDvgjcjHKkdCeR1546dPx56leMVZO7fb+vx/Wx6WFy+dV80/dS1s1o9PmeVahql1qEheWRipOQrdgRgj6479a4ZTlJ6s+gpUKdFWjFXta6/p6f1czqk1CgAoAdFFcXU8VrZwvcXUzpHFBGMyOzsFXaDgZLMAMnFDcYRc5yUYxTbk9lbXXrsn5jjFyaik22+h/Th/wRu/4I0eI/jt4n0X4tfGXRJbHwhp99Fnw/r1jiPVrS4kSWK4jdElHlGOE4JZSRJyOtfzF4yeM2HyPDV8pyatGeMnTf8AtNCetGUVZxabTveXVPax+o8HcG1MZUji8ZDloxkvcqR+JO1raPp6fjp/fd8LPhd4V+EvhHSPCPhLTLfTNO0qxhsY4bZdsflw52gDA4Ga/gbNM0xWbYutjMXVlUqVZym3J3d5b/0j92w2GpYWlClSioxjFRVr2sv6uekV5p0BQAUAFABQAUAFABQAUAFABQB4P+0P+z94C/aN+HureA/HujwavZ3Vjfw2KXGzy7e6u4BGsx3xvwGSMnAB+XrXvcPcQY/hzMKWPwFWVKcalN1HG95QhK9tGu7OLHYKjj6EqNeCmnGSjfo2t/wR/nN/8FV/+CPfxO/ZV+Ims6/8NfC994h8FXd5Glpp/hvS3uBHLeXZLOZIgq/KsylvkH3Sc1/ot4VeMGWcVZfQw+ZYqGHxsINzqYmqo3UI6Kz1+y7a2/T8H4m4UxGX15Tw9NzpSeihF9ZP1vbbfofjeP2fvjv3+EXjnI/6g0/9QK/ZHxDkK/5m+B+daK/zPkf7Oxq/5h6v/gMn+SF/4Z++O3/RIvHP/gmmpf6xZD/0N8B/4PiH9nY3/oHq/wDgEv8AImtfgf8AHnS7hLxfhF45zFzgaLPnkj/Dj+VKXEuQ01z/ANrYF2voq0ezt99n/WynkuNxUJUfq9X3v7j/AMtH2O/ufhr8fb+0ijg+EvjuLEe186NcHJ55HGe4+n5VT4oyOpGyzbBLTW9eP6tdv8+t/Fjwvi8PVl7TC1J+8+X3Hovx/L8Ecs/wF+O8jF3+EnjcsTkn+xbnr+VZf6wZD1zfBX/6/wADtWV46KssNVS2+CW33Df+FB/HX/oknjf/AMEtz/hR/b+Qf9DbBf8AhRTD+zMf/wBA1X/wB/5B/wAKD+Ov/RJPG/8A4Jbn/Cj+38g/6G2C/wDCimH9mY//AKBqv/gD/wAg/wCFB/HX/oknjf8A8Etz/hR/b+Qf9DbBf+FFMP7Mx/8A0DVf/AH/AJAvwB+O7vHGvwk8b7pXWNf+JLc8M7BQenqaT4gyFJv+1sForv8AfwaHHK8c3b6tV/8AAH/X5n9F3/BHL/gi34k+NHibSviv8c/Dj2nhbTr6SCXw3r+ntaXczpcGS3nUyiQbFW3yDs53rX86+MfjRhslwtXKcixHPiqkIyWJoVFOEVy+9HRrW8u/R/L9D4Q4MqYupHE42nalGTThOPLJ2krPXp63P74/hp8OPDXwt8J6T4S8L2Een6bpdha2UUEe3aEtYhHGBtVRgLwOK/gfM8yxOaYuti8VUdSpVqTm5Pe8nd9XqfuuGw9LDUoUqUVGMIqKS7KyX5HoFeedAUAFABQAUAFABQAUAFABQAUAFABQBw/jn4deEviLpg0nxXpcGo2ayiUI8cJbeCpB3SRSd1Xt2ruwOY4vLqjq4Sq6c2rNpu1teia7mNahSrx5asVJfL/I8S/4Y2+AeSf+EPgySSfksupOT/y5V7f+uWf/APQY9POp/wDLDj/srBL/AJdL7o//ACIf8MbfAT/oUIP++LL/AOQqP9cs/wD+gt/+VP8A5YP+ysF/z6X3R/8AkSN/2MvgDIMP4OgI/wByy/8AkKplxhn0lZ4t2/7f/wDkxxyzBxd1SV+9o/okPj/Y1+AUQwng+3A/3LP/AOQqa4wz5Kyxkl/4H/8AJillWBk7uir/AC/yJP8Ahjr4C/8AQn2//fuz/wDkOj/XHP8A/oNl/wCTf/Jk/wBkYD/nyvw/+RD/AIY6+Av/AEJ9v/37s/8A5Do/1xz/AP6DZf8Ak3/yYf2RgP8Anyvw/wDkQ/4Y6+Av/Qn2/wD37s//AJDo/wBcc/8A+g2X/k3/AMmH9kYD/nyvw/8AkQ/4Y6+Av/Qn2/8A37s//kOj/XHP/wDoNl/5N/8AJh/ZGA/58r8P/kRV/Y6+AqvHIPB9vuidZEPl2fDIQyn/AI8/UCj/AFxz9pp4yTTTX2+vpMP7IwP/AD5X/kv/AMie/eGvCeheEbBNM0GxhsrRAu2OOOJPujA/1caD9M14GJxdfGVHUxFRzm+rb/Vs76dKFKPLCKS009NDo65jQKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKAP8A/9k=`,

    aItemIcon: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAABGdBTUEAALGPC/xhBQAAAp5JREFUSA21Vr9rFUEQnn3GBA3GHwHB8FAhaQRLbdRCDEggaESsxMbORiuxsRDB0j9AsbBJZ6FGbNJZ2Zja6gXv7hmjkARilURv/b7d2buXu9sXIWRgbvbNfvvN/pidfUb6Srctks8AMg0dh44pfAm2A/0o0nov0u6qv2ZMzeMcKYjsUxFzF3ZfMyZ4zV9gXgP7ROQkA2+ThgDpdQyYBeoQdAv6DrOEmi8ig0qwyQmcw+puoJ+6H/obmDsIMod2TLIHImkukljYtyLZRAxZ+okh1o3BasjRKJx5CgA1e9QI6evkmDCeXNuEe56s+1nEyL9fAMFDKM4lJhzLlZCLnIUkr3wHlxqTdF4xf0SWj8dQINbtIidORcSl4jccGvbenMEhdeqDk6Po+wXMgPbdEzn1so6jJ0U626/At5Acp/FhnrtURKY0kTuaa0r+U0lvqW0wjgNc5MxnEMBdIhimYkzMTd/TegyL1DWXsfLRGLqHa5oBsCQK87xJlofhvQoF8cE3sJ/8aizzPyIF1zgD6GmHS1QdszUFwgPwgngU2dGa8wjbZ5sKrjEG2EFs2J4PHjig1k6KrB3ZYbAwQM/1r8LtIGbPQgfJnyFDVrBTC/43y8N69UJpF0uJkyUG0LRkbalK9wo8h9WL2mSPeQ04E9kme14RHQZAyaW4wuWbxTfX7TEv4Drbozpzi8NfGSngRcOVeP4iNy9aituZbPpLElAWwRPkvbv6l4K3tMmi78tulz62eNEcFzi7bZDwsWA9dyX3eQnOLqKNkmBWcQE/l/7QMlpWatlEDpwPOYuH6H+KXSDuZ6PFjoP2tFyHWfGxYE3f1YNzP7DRoppWhSuJPZlDPzx64wQwSEWXLSwZ0SezIQAp9vTR93P0393/bfkHEt8Mbyf+xBUAAAAASUVORK5CYII=`,

    bItemIcon: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAABGdBTUEAALGPC/xhBQAAAjpJREFUSA2dlj9rFEEYhxNNIWIsAgoeqUxQkZT6JRJQ6wTFPphSGwtb7awEJWIpgaCCFoIfwQ+QEI4oiqWFIWDUqM+zN++xuze3e7kfPDu78/6Zndl35m5yolmzmK/DEsxBB9Q36MI7eANf4Ugy0TP4A/9a0EffGJzbZl3D/ANM/As2YBkuwKmE9/Zp00dfY4xt1BrWv2DAK5iHNumjrzGHYI6sHF0HuZv1aO40JuL7M5lMMR3aLZiGe/AIQpe5WYyH1O7TfoYP4BKFHOQh7MElsBgK+ZFiWVJXv7mZbNrrvKfvZN+zdxPLZc5ClqKV4JtYinXFAL7xc3gBm3AADngbyjKHucxp7olV0HHDh4xiAOu9LJfSuPVyZ7o3l7bVY1zcROp1rxn5arWpT8W1eolcS1P0x7J8rPoMPF2k5wFYGGfgFnyHl1BX5Cpy+8Wdjpsop1gifeo8zgXQZy5995zBqNrF8S04g9Ng6a6BOfyOQ7WNxdHc/jnFDOofeQFn4w5hphZoLm3bfuRuMl5J7ajNDo4mN8fZWtDV9NzV6JGrbvSaodcTWM4lztPeh+PwG75AWR7xqsjtZnBTtG00p5zjKf1lWTmVjabxKEeFy/ITPGeegDMra+Co0NiB+A0Y5ySNAYx1luYyZ0Uesb6djDOIMRFvrqysa518C6c6D23SJ5bF2DttAY4ey+XH8uBaBmvb3wvxfgW06RPLMvTN8anI9fPDW125yin36aOvMQNy2zfJEramx/7b8h8EabY5kFAcZAAAAABJRU5ErkJggg==`,

    cItemIcon: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAABGdBTUEAALGPC/xhBQAAAkxJREFUSA21lj9rVEEUR1+iIkpEK8Vl1cCKoJ2gX0IxksLCtbCxCwnY+CkErQySb5BGRAzaC2ksrOyiFpImjSRNImo8ZzN3nffynCeKAycz797fvTM7fzNRFcpuVfVx34TrMIAeWNZhDV7C84mq+kz954XEPViCb7DbgRq10Xm5I4QzsAkm/grLMIQLMJWwrU2fGrXGzBSzI1iAH2DAMzhfDMCpJmmN+Q4LrTE4HLkCedAqKhiNyeLrvwRHD2Ja9iXHNwm34CE8gbtwoNkfNjuJ6fq1JhhdpNG0tASdwPcq+dUEq7SPt+idWjVLIx+NPrgTXCy3Yq1gc8QGfIFFeArboG2xJuYD2wDMZc6+hjlQvNwiPoN9BxRfDj/teTBmC46EPWps7i79c3awkj6GIYhaQfK9CJs1tsNwHy7l9mhjH4IdrBzEGNPyNgRZPZ3a7zJbxcnd4ftRbmu0I9dgEkestse/WaaTYaPp6PiOXD07KJXt5DxaEpV8djDurUX4IdlON33M7z042bSn7/Gs2IG3ouXKXlX7+z593SAZU79XaF+k5T7/RHsqmfPqavpY69qmh0jwEdwRj+EYnII3oO11njXa2GvbtOug3SYgLkDPQ7Q9H/t+Nbb6QbNXjL+9KpJ/Fs06OGpxaq7FiPMae/2qSAmKl10kIPgsnIPxeoQv5Wm/7JLz/13XMQpG5oPje+A0/O2DMx/5WmsS+0vibfBWzJ9Md5H4ZN5JPjUOqPvJjB4RuyYuvLvG4BJq1MbhijSjunWxQkHQP//b8hPll4sgtkhEcgAAAABJRU5ErkJggg==`,

    checkmarkItemIcon: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAABGdBTUEAALGPC/xhBQAAAl5JREFUSA21Vj1rVEEUPZNEIQRBidW6ahFLS22tFJVF4w+wEbQKCdgoFiIqiJWNhaCFjb0fYL8IiqDY2LrFvreEYJNExYRV93nOfLw3m0w+NLwLd+/MnTPnztw3c2cNNpVeExhME9KiTlEbHj5P26G+BkZeAs2e968zZp3HOjISFbcBc4l2NI0JXvOHmKfE3gIOKfCQJAJk5znhGVF7qL+oL7hKqvkI7PYEfS3gGHd3gePSXdTvxFxkkFdsbyT5HJANgG5B+xzIj2yErPzCCGvncDfiSIpWnhEgza8lIZs6NSfMF9eQKOfdb24V/0MeyDRXOxGXOEvpPnED2upOJaRLnFZ0FLPfDNDfXs7jBRQ8JNmJ2OM4xCXOXnPEnXN7FHlSDn4ZBm/Vyx8S0SbplQppOcglzsE0A9hLRKOj+C+SPSDJDJW7KO4Bi3ur2SVXSwF0Qyk652tFkxcm1nqZzvskver9i8DYaWDfUoUruaYUwH/tcIkCzOb3MdBvM5eTwcvc3mH7uu8vc2Ekb3yqxtUquRpjwwNxL7/B3mWulGbQBr6eAlbVv+lRvLmjZ1iHPvh+0mgH0fWPMcUjrs5PLo6S/DPJ7zqE+cG0nCX5+3hG1VYpsTKvAB3XVm2J5TBzO3GSnnfOW+x31vykbQEH3rp+6rc47r0dBWDJldjC5Zrl7yRv5DhzbNrOZVZ42s6xoL0pIclGySXu7Vy0fJwfl1Wyy++wlaj4VRfNo2stFYpRe7GzQeos1z5T9rFQTQ8PTuZveRhPWWFCBbVvyWyMqv3JTARQ/Fof/XiDO//b8hdF5gm1Zxjg3AAAAABJRU5ErkJggg==`,

    exclamationItemIcon: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAABGdBTUEAALGPC/xhBQAAAdVJREFUSA21ljtKQ0EYhRMtbGysxJAu4gp0BZYB09sJdqJg40YEG3cQEbWwdAcuwYCFRCxsLH2fL95z49zJzI0QD5zM4z//mcwzaTbyaCvcE7tiR2yJYCgOxGvxSnwQ/wSMTsV38auGaNB6cFXz2FL4RcT4VeyL2+KauFiQOn3E0KAlh9wsDhT9FEm4EFfFOqBBS86HiMdEMDoCeDRRke8kx/nRTFoKellS5ofSHBdcUTkJ5Hq58CzBJnlZys5K5bLQoFuuxH43vVx4jsBR5CSwWbk1P1Ec8zdxTkwBD7zwbCPknM+LfMM7MQXOPngSOQgp4IEXnj0G4BIBOnPwAC5zWnt1GYAbCm5/iuSnjR+TinHAXh0G8G7bYCwLa467DKNhy5oWA0wLJ00zg9KTAZzomZTBSuVZbU6H9ZVw0LTXkAEGRWg9kMQNjuiueBOHop6NomfkvacGyTxcs8KZjPDEu9EWuRRMP3fRFhQ/FzfFHIKLZuE0T8WSxPfijpMSZfRUoGNT6h67hF/QnXzsUP3rc+2vwY8FbzobxFR9y1VNAo2Xhdz9pLIIMBMvFxs/059MD86esPGcLmaTIxq05ERoRj1hB0eY55wXl6WwCbeZS1T7t+UbkkKQgzJAs2oAAAAASUVORK5CYII=`,

    xItemIcon: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAZCAYAAAArK+5dAAAABGdBTUEAALGPC/xhBQAAAnhJREFUSA2dlblrVFEYxV8UtVAsRBSCwhBtbKy0imATcIlr44qVja0KbrgURtz+AUHBVAraiJWNYKGgIG6FnRIXgo0ILhA39PcL9xtuXu4bJx443G8537nv3Zk701N1h8XI+mBvko+yvobvUv5fyzymTsEX8E8D7alR2zV6UB6En2AYG9+D1xKN631nnO2IOXRvwTC+QzwAZ8A6rNlTE3pn9ShiFtUHUPFHuA52C7XOOKuHXpMwTEXBCFwCpwpnRqAew3AC1pLZ+AKXZ51WFjeFy7KGs3rotSbq0wiepeL+KLL6oY3BwaxWD/dQ+AUPZA1jN9BT72oVtPAW5md3MdW/s26Edeyi8Bs6eyhr6qGX9X7rYXTBpIbz5ArdZHPW20Hsk9s7ktUj1Mue3tWjlKw2KeAsNcU/4Fa4DYb5MeIS9HLmoU2vu8kikwYMUVfzM9H4BGyCXmrGf0p8fZOZsBNu0lQnb3QS0tNLnd7Vh5QsNGnAFuoeUWzgm2xv0FrWS63e1dOUrDQpYBO1MD9NfBI67OewE5agl5onNi+npPSBbaAXR3hGccJx1thkdxSzVS/7eo9fJJPnJhnWE4f5uawe4VEC57wLXrgcetkbtOjFeA8t+BUMXCGwVrofoTmcNFejwKqHc3q2L+7eVPQGLoDCa+6F+hd8SrXC2bjFerYxneg+dGfX2XCqcCb30HMC3P0NdBPPsAW7RQthnLsecQqT5pdSeQnd5BscgvNhE+ypUeuMs3q0UfoPnUv3EozvuN8S/6Uew1EoeuEK2A/jKK4T74OfYVfwstyGY9CnK9GeGrVFlN6gLvRPfAD2QZ9c+Cav4F34FTbiLzwMvzaY1WE7AAAAAElFTkSuQmCC`,

    oneItemIcon: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAABGdBTUEAALGPC/xhBQAAAdRJREFUSA21lj1OAzEQhTeIDrhAiGiCKJGQoOAMkYAajhCRksvACVLwU6SkQEgUCLhBKhAHgAYh/r5v11Y20sYJgYz01mvPmzexvR6nliXsO8sauHdBCzRBHWjPoA964KKWZU+0kxvCdXAMPsD3GMiRG5OnE0HcAS9A4XfQBftgDSwG+O6YPjlyjdlJqkPogC9gwBlYTQbglBO4xnyCTmUMDn+5BHFUSUoMGlOKH54JjjqIy/Jr8Zg3JInLNdgTHG5SviyRPG2Ljkur1nGuwUsD+CW4WX6KlYZvAZyCN3BZSWIQXxOopWbDgTYwYzcRtIz/IfDkXo/iOq5W4Lbn6HuItPOiGX5CXGHkFmyApHApMmq15hmMy3JXIpRfH+ncgHtwFd5pkha1mk7nNUxncVQIfqpBPvXtwE3OBI4H0qV8dYnGGupwpzMTWLi0wXdb9P/yjFrPJrAqaptF8y/PraDSN4ElV9srmn95WuK1nos70UGTDXcd3IET+1WGb/igSWJwdqUiJJhtsQtJZleuTaCxVB3gfeAhmfbCOSzURjwRdibxbrAqlq/MJfrCK/Mg+OT4g8ZfmTEnZPfEjbfkGpyCHLnxcEWZvM1rzNBIqUPQn/+2/AAyMDN57nlhHAAAAABJRU5ErkJggg==`,

    twoItemIcon: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAABGdBTUEAALGPC/xhBQAAAjNJREFUSA21lrFOVEEUhu+agA2E0K6rMcGQaGjQzsIHgASJocKKegOx8h18BnoLGrRgX0BfABpCYaIJ2EA0gUQDEfD7lhmYy529u2iY5NuZe85/zrkzd+7cbRQ17bwoWrhfwixMQBNs3+ELbMDHRlHs0g/eSNyEVfgD531QozYWry+EcA4OwcQnsAaLMAkjAcfa9KlRa8xcbXYEK3AGBqzDo9oAnGqC1phTWMnG4PDOFcjbrKjGaEwSX54JjibEZblx8lg3FInLdfVMcPiQussSxbkezRiM53zRht+lNddq18agBe4EH5ZbsdKwP4ctMFA24VlFiAH7BJjLnC0NbTBorUfAOL6DoNmn/xHG3+jv9Ihxd5mzrcCXyPbhoqv8TgeLL9Y9cJa/4EEY01VazDXrDHZCtcmKLGNA+wTiVr6fkZjT98QZ7HhxFC5GcuLUhm4K9oK+k/rSMX5fSAscDVwA8Qv4GQI/0Y+lSdMxvlKBvktEwCv4Dd7Ve7ibJrw+xl9aok4IXLwu9BrfAvh2m/wdDMNQgIO02vC9BvUdd5FHrm3+oqv8PsUSt6Nv+TGcBGboc80j3rbRoIpn/lc4g8fcktvxsuFvc7F0aSgP3qD/nJrQu423wZt6CN1lGOio6Ir7/FCgfFSEArd72IUit3dcx1kzPT84ccc41X/54CzHfNmepM4kfhs8FdNP5ijX4j53K97skxkrEugz8cF75Lqf61Cj9uoDExPRs8t6N4L++2/LXylieLfBs7w+AAAAAElFTkSuQmCC`,

    threeItemIcon: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAABGdBTUEAALGPC/xhBQAAAfpJREFUSA21lj9LHEEYh/cUAgEtBCFyCGKipoh2CeQbWBxqK1qnEm1EP0G+Q4p8g0AMKZImZVKmCWk0cIUgV2mjpBFN8jzHzMHdzs1uDu4HDzt/3vc3uzPv7l2jyGue6S1owRNogupAGz7BR7iA/5JGb+EO/lZgjLFxcZp5bTJ9DRrfwjvYgRWYCth2zDljjDXH3KwOmP0DJnyAJaiSMcaacw96JOXqBshxMiI/aE7MLz1Jk8m4LaOYx6XNjdulZ08eUtyW3uBAY4L+HHgOOcXt0rMrS9FK8LAsxZSOGLwEb0K+wlNISQ+99NS72AOTrIiUthmMxue0f4f+j1RwGNPLHL2Lz6GzYyehNcYO4XWYe8w1LvgwjA1e9DJG7+IsdKztnB4wuQivwOTcE+hljN7FTehUHd7LEGfiT1iAYdLLOL1rL7BM7AmcgsnvYZj6Fqi7RZPBzWsHXGQ1jA1eeltkbbfD7PPBqNDf5/oLvsAMPINZUL65Kb0Ig13vqjJdJ1gj7zhebX+HBqTUV6Z1XrQNXL7BFXhXb+ARpFR60Qyq86lImaXGSp8Kg5ow1o+di4z1c+0C6gDiQY76g2PVZeWTxO26pW1F+G2xtqcDtnfBOWOsqlo/mcR15Zl48H5yTc5hjLHmlDSsjmOgJbwFLbD8oolvsuVa+bflHx0kqm7y6LD/AAAAAElFTkSuQmCC`,

    fourItemIcon: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAABGdBTUEAALGPC/xhBQAAAjNJREFUSA21lr9KHFEUxs9oEkHwASKLKbSNRTBPIahVGgUR7CR2BgKC5AVSWEkCsUllYyLkDVJqr4XF3F1MEVKoiNHEnfy+e2d21+yd8R/7wZkzc+93vnP/nLkziVWiUTNrTkOZxEax4Zx+hD/Evpn1fTWrNfL2Lpd0tfgGh1D2zixZwPfHOUVrcgVnE+6a2YgSX0MkgZsi4DOsIewP9oVRYsmu2ZNc4FIDmGB2M/TLHmOncOZIssN9GerLZq5plmb4bbP6WBmz3S6OuD6G2UgjCo3cQZDV30QplY2KKeKldQ1a8/QkjOI+4oWYYjUTaUmzhfRj6NBUH4piuaTpoVJ0f0lwiVcpVsCxse4M7m9sPk6UhtdCs1HrC3XuS5FKGTmMB6k1U6V8wg/iB6gYYmPwGmhJszktkl4ioFKsglsl6DmMiypW6GtpTSpBviyq8zLUx+l5ix1gW2WsdntLa1QJ8t0uXqI2Ldxlj5jqJkuCt0WM9b8JLa3hknXsFHArPL3ANsyefe/suc29EnS8/tEQjVp4RXXATWbDY/ae5/Vw//9VR4nHkRLklaOzJYZE/fts8E/8MZ5y9jjnKosge5k3KtYtMRK9fbfYPIWlHwLfcdKWQVr+bFpiBjrPdeTqVLzpRZNgknLZw37pqRteAy1pStujp0eFMvT8sPNJenlc+3Xi4j84rJ3foPt+cF4XavJ3/GQO/AjBF08pV0rR/xCwoeWfzEgCSfT0ox/GGK4P/235B1u3+G1ANm6sAAAAAElFTkSuQmCC`,

    fiveItemIcon: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAABGdBTUEAALGPC/xhBQAAAnZJREFUSA21ls9qFEEQxmuiSRAVclFUEg1EBEEvovgGXgImF/HixaOKnsSbiC8hggcPehX/QPAlFMSLBFlwe5YEBY3GQDTqjr+vu2fjzPQmkrAFtT1T/dVX1d3VNZvZhtIZN+vOAJlGp9BDEb7A2ELnzIaem413or0xZA2LNziIirtm2WXGHWlMac3+gHkI9o7ZYQWuSCKAO4/DY1B70V/oM7JEs1dmI5FgTQmcZnWzzEuH0e9gLhHkBc/9JL9h5rpm7YLxqVl+tB9y3S6MsN6H1YgjKcrcAZDmt5KQDY3yKf3FVRHteXs5ZLEV8pJMvlqJuMTZk/aDMKGlblfK7RInp2LmS/EDh8beZ8c5pFYzhFthfmfN/tXsyIGajVdHORfv4BqiOCb5UZ37UqRSUuQFSRS78RzFqYO2o+ZNclk8B1zi7M4oK10iRKWYlH8yz06aTawmURWjuLoXME3LmSVJVOcp+Tiybi2esAXfyO4lmT7ChwNNSY9riuU7Lkixx2wXF2s/e12XpTGz5aW6FfJ7BLnWtMvyCb5VXbwVzmAzGfsB4hxbSF8ansTpdvAorpot7tvMm3k3H0q0c+w/wBHiOGjVe3427SMuf7PntYJYluotKXFXSOItqsqg5yycAjURke9THuDORHtLAWi5Et+4wmPlV2VpJ3CinN1n+t9rnjm77D5xvlSgvRff4vUmbl0095slrTHGiuoh44O7yDzECuDeoDfDauo4vYvDc8Epbi+DaxUxwMCbneIMtF3HhfiPhXq6LzE665Y+ONdLNo1UQ120kn6fzNHFgP55EAyl6KtlFlvfT2YigCgG+tEPOYbf7f9t+QsIlQ+SD+zMcwAAAABJRU5ErkJggg==`,

    thumbsUpItemIcon: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAABGdBTUEAALGPC/xhBQAAAlxJREFUSA21ljuLFEEQx6vX8xH4iD1XOThNjAT1Kyhy6JlrYqSBGpqKCBoaiIgYmJgZ+IBL7itobOSC07t4oAaHgtyd54y/f0/PMrszPZ6vP9R0T72ntrp6nXVi1DfLF1FZgOah2aj+gXUALZn1Xpr1R5HfWFyDExgeR8UtM3eJdVu7TsV1P9B5gu5Ns0MKPIGWAP4cBk/R2gN9h16QJeTemO2IDjaUwAm+7jxy0XboKzoXCfKKfQrD62aejLKC9TmksvwCw8OlbrDBdngtYaDMfQ5J6UZCqYMtG9kGwtcEVPPsS5l5l/PsOA4+QScnzMcvstWXyJd8jpE9LgUqSxf8g5jE3bSWfIQg+AxQK/pNmBuUhnqm8HE3OqulsX+Y0ip9yJd8jvq9ss9DK9IpB9+lDddoANsX5Z/TesEHvuQzXyRAOEQsasU2FOj4K0hu16T8FtlZMjyGo101ftzq8AUszLDEVlSfT8Pf55NP4+TIpKQ4wztE05jPeMxBNbjX8WVeAeKvXR2imp4VV+tvif2dJn/nitk3sWdVogjXcqorWed6OS0tVF+Lx399f1oxKVk3m9GPPwWNEsGtKMAg7MNsKXe/8Vwz2zzQ1M+ZUwEDBWDkCmFwldvx091j+4xMYhJjQdw4b7Z3eZpb87VE3cPMf0+nMId6R9NnQS2ZX8DZKUidtwo9YnrW2xeWDmv+lqRIvjcHQ9jqqCi1u5+NUSH1rQ67btdknxp2IYjGdRy3XRM1FUQ2lb1Gfyv+5MLRpVSVRQEmL5yWw6Xo/+7KbAmgT/uvl369dn//t+Un+N37WlazI80AAAAASUVORK5CYII=`,

    thumbsDownItemIcon: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAABGdBTUEAALGPC/xhBQAAAftJREFUSA21lr9KA0EQhy+pLCJYH+kiqQXxKcTYWcQXEIKWFoKVhYVgIyKSN4iFWJiXUAvtIgoW0cZG1Er89/1k1uwtm0s0uvBxezu/mdnb3Zu7QpLTPpKkjHkeZqECKajdwTUcw1EhSbpch28ETqEJr/AxAGmkdcnzEyGswSMo8Au0oA5VKBnqa0w2aaSVTy03OoIVeAc5HMJkrgNGaUwrnzdYjvpg0MwlEKtRUc6gfDz/7JNgSMEty4+Du7yWxC1Xb08waJO+lsWJf3sljpZWsZpfMeiUQSdBm6WjGG3YpmALzuEZurAeihnTniiWYpa1SQ1QxlZEvK1xuDKNdD4X3E9E/A5M11CCtt3UI0I/WKz/gO9CxG/RYraLGN2ynIbCIe7H0NxGdCc2VtETPFm2Uii08djM/bGziN+4+T7pCUZt+7kByNSxbNVQyPgOXJrdn7Xfv4n4qZRI08ndZDkiKsIS6A13gXUw5kBHV/uQaYx9b7IC9D2mvhe6NXAJNnxb2EeXOabDvmiqpDqWSrIXBnX32LIvmgwMDlUq0O2CEmy6gOEVW7ZUWIIUw8Bih2Ya7mEmDGxxVFE1AcXqFTsz/l+5drMhqz447rT87QfHS6Incculqhh+MvWW/u6T6SXRnmjjVXLd0ex3lUba7JpbMP44+jecRv5t+QRVea4cytddYwAAAABJRU5ErkJggg==`
  }),

  /**
   * Singleton of PDF font settings
   * @type {Object}
   */
  pdfFonts: Object.freeze({
    header: {
      size: 13.85,
      style: 'normal',
      weight: 'normal'
    },

    score: {
      size: 28,
      style: 'normal',
      weight: 'normal'
    },

    sectionHeader: {
      size: 20,
      style: 'normal',
      weight: 'bold'
    },

    noteTitle: {
      size: 10,
      style: 'normal',
      weight: 'bold'
    },

    note: {
      size: 10,
      style: 'italic',
      weight: 'normal'
    },

    item: {
      size: 15,
      style: 'normal',
      weight: 'normal'
    },

    signatureItem: {
      size: 15,
      style: 'bold',
      weight: 'normal'
    },

    na: {
      size: 20,
      style: 'italic',
      weight: 'normal'
    },

    summaryHeader: {
      size: 22,
      style: 'normal',
      weight: 'normal'
    },

    pageNumber: {
      size: 13,
      style: 'normal',
      weight: 'normal'
    }
  }),

  /**
   * Singleton of PDF RGB colors
   * @type {Object}
   */
  pdfColors: Object.freeze({
    blue: [0, 0, 255],
    red: [255, 0, 0],
    black: [0, 0, 0],
    lightBlue: [82, 152, 242],
    lightGray: [134, 134, 134]
  })
};
